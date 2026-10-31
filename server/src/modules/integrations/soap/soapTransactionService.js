const crypto = require("crypto");
const mongoose = require("mongoose");
const Payment = require("../../payments/models/Payment");
const Order = require("../../orders/models/orderSchema");
const Transaction = require("../../admin/finance/models/transaction");
const Subscription = require("../../subscriptions/models/subscription");

const SOAP11_NS = "http://schemas.xmlsoap.org/soap/envelope/";
const SOAP12_NS = "http://www.w3.org/2003/05/soap-envelope";
const TARGET_NS = "http://auctionx.internal/soap/transactions";

/**
 * Validates XML payload against XXE and expansion attacks.
 * Rejects any document containing DOCTYPE, ENTITY, SYSTEM, or PUBLIC directives.
 */
function assertXxeImmunity(xmlString) {
  if (!xmlString || typeof xmlString !== "string") {
    throw new Error("Invalid or empty XML payload");
  }
  const dangerousPatterns = [/<!\s*DOCTYPE/i, /<!\s*ENTITY/i, /SYSTEM\s+["']/i, /PUBLIC\s+["']/i];
  for (const pattern of dangerousPatterns) {
    if (pattern.test(xmlString)) {
      const err = new Error("XXE vulnerability detected: DOCTYPE and ENTITY definitions are strictly prohibited");
      err.code = "XXE_PROHIBITED";
      err.statusCode = 400;
      throw err;
    }
  }
}

/**
 * Extracts inner text of an XML tag safely without external entity evaluation.
 */
function extractTagValue(xml, tagName) {
  // Support both prefixed (<ax:Tag>) and non-prefixed (<Tag>) forms
  const regex = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tagName}[^>]*>([^<]*)<\\/(?:[a-zA-Z0-9_-]+:)?${tagName}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Escapes characters for XML text nodes.
 */
function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Constant-time comparison between two strings to prevent timing attacks.
 */
function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// In-memory cache for replay attack prevention (5-minute TTL)
const seenNonces = new Map();

function checkAndRecordNonce(nonce, createdDate) {
  if (!nonce) return true;
  const now = Date.now();
  for (const [key, ts] of seenNonces.entries()) {
    if (now - ts > 300000) {
      seenNonces.delete(key);
    }
  }
  if (seenNonces.has(nonce)) {
    return false; // Replay detected
  }
  seenNonces.set(nonce, createdDate ? createdDate.getTime() : now);
  return true;
}

/**
 * Generates authoritative WSDL 1.1 definition for AuctionX Transaction & Settlement Service.
 */
function generateWsdl(serviceUrl = "http://localhost:5000/api/soap/transactions") {
  return `<?xml version="1.0" encoding="UTF-8"?>
<wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/"
                  xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
                  xmlns:soap12="http://schemas.xmlsoap.org/wsdl/soap12/"
                  xmlns:xs="http://www.w3.org/2001/XMLSchema"
                  xmlns:tns="${TARGET_NS}"
                  targetNamespace="${TARGET_NS}"
                  name="AuctionXTransactionService">

  <wsdl:documentation>
    AuctionX Enterprise B2B Financial Transaction &amp; Settlement Ledger Query Service.
    Authoritative query endpoint for payment audit, reconciliation, and order settlement status.
    Note: Real-time buyer/seller checkout executions are processed via Razorpay gateway.
  </wsdl:documentation>

  <wsdl:types>
    <xs:schema targetNamespace="${TARGET_NS}" elementFormDefault="qualified">
      <xs:element name="GetTransactionDetailsRequest">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="TransactionId" type="xs:string" minOccurs="0"/>
            <xs:element name="PaymentId" type="xs:string" minOccurs="0"/>
            <xs:element name="RazorpayOrderId" type="xs:string" minOccurs="0"/>
            <xs:element name="RazorpayPaymentId" type="xs:string" minOccurs="0"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>

      <xs:element name="GetTransactionDetailsResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="TransactionId" type="xs:string"/>
            <xs:element name="PaymentId" type="xs:string"/>
            <xs:element name="Status" type="xs:string"/>
            <xs:element name="AmountPaise" type="xs:long"/>
            <xs:element name="AmountINR" type="xs:decimal"/>
            <xs:element name="Currency" type="xs:string"/>
            <xs:element name="Type" type="xs:string"/>
            <xs:element name="PayerEmail" type="xs:string"/>
            <xs:element name="RazorpayOrderId" type="xs:string" minOccurs="0"/>
            <xs:element name="RazorpayPaymentId" type="xs:string" minOccurs="0"/>
            <xs:element name="VerifiedVia" type="xs:string" minOccurs="0"/>
            <xs:element name="Timestamp" type="xs:dateTime"/>
            <xs:element name="ProviderNote" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>

      <xs:element name="QuerySettlementRequest">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="OrderId" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>

      <xs:element name="QuerySettlementResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="OrderId" type="xs:string"/>
            <xs:element name="Status" type="xs:string"/>
            <xs:element name="FinalPrice" type="xs:decimal"/>
            <xs:element name="DisputeHoldActive" type="xs:boolean"/>
            <xs:element name="WinnerEmail" type="xs:string"/>
            <xs:element name="SellerEmail" type="xs:string"/>
            <xs:element name="PaidAt" type="xs:dateTime" minOccurs="0"/>
            <xs:element name="ProviderNote" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
    </xs:schema>
  </wsdl:types>

  <wsdl:message name="GetTransactionDetailsIn">
    <wsdl:part name="parameters" element="tns:GetTransactionDetailsRequest"/>
  </wsdl:message>
  <wsdl:message name="GetTransactionDetailsOut">
    <wsdl:part name="parameters" element="tns:GetTransactionDetailsResponse"/>
  </wsdl:message>

  <wsdl:message name="QuerySettlementIn">
    <wsdl:part name="parameters" element="tns:QuerySettlementRequest"/>
  </wsdl:message>
  <wsdl:message name="QuerySettlementOut">
    <wsdl:part name="parameters" element="tns:QuerySettlementResponse"/>
  </wsdl:message>

  <wsdl:portType name="AuctionXTransactionPort">
    <wsdl:operation name="GetTransactionDetails">
      <wsdl:input message="tns:GetTransactionDetailsIn"/>
      <wsdl:output message="tns:GetTransactionDetailsOut"/>
    </wsdl:operation>
    <wsdl:operation name="QuerySettlement">
      <wsdl:input message="tns:QuerySettlementIn"/>
      <wsdl:output message="tns:QuerySettlementOut"/>
    </wsdl:operation>
  </wsdl:portType>

  <!-- SOAP 1.1 Document/Literal Binding -->
  <wsdl:binding name="AuctionXTransactionBinding" type="tns:AuctionXTransactionPort">
    <soap:binding transport="http://schemas.xmlsoap.org/soap/http" style="document"/>
    <wsdl:operation name="GetTransactionDetails">
      <soap:operation soapAction="${TARGET_NS}/GetTransactionDetails"/>
      <wsdl:input><soap:body use="literal"/></wsdl:input>
      <wsdl:output><soap:body use="literal"/></wsdl:output>
    </wsdl:operation>
    <wsdl:operation name="QuerySettlement">
      <soap:operation soapAction="${TARGET_NS}/QuerySettlement"/>
      <wsdl:input><soap:body use="literal"/></wsdl:input>
      <wsdl:output><soap:body use="literal"/></wsdl:output>
    </wsdl:operation>
  </wsdl:binding>

  <!-- SOAP 1.2 Document/Literal Binding -->
  <wsdl:binding name="AuctionXTransactionBindingSoap12" type="tns:AuctionXTransactionPort">
    <soap12:binding transport="http://schemas.xmlsoap.org/soap/http" style="document"/>
    <wsdl:operation name="GetTransactionDetails">
      <soap12:operation soapAction="${TARGET_NS}/GetTransactionDetails"/>
      <wsdl:input><soap12:body use="literal"/></wsdl:input>
      <wsdl:output><soap12:body use="literal"/></wsdl:output>
    </wsdl:operation>
    <wsdl:operation name="QuerySettlement">
      <soap12:operation soapAction="${TARGET_NS}/QuerySettlement"/>
      <wsdl:input><soap12:body use="literal"/></wsdl:input>
      <wsdl:output><soap12:body use="literal"/></wsdl:output>
    </wsdl:operation>
  </wsdl:binding>

  <wsdl:service name="AuctionXTransactionService">
    <wsdl:port name="AuctionXTransactionPort" binding="tns:AuctionXTransactionBinding">
      <soap:address location="${escapeXml(serviceUrl)}"/>
    </wsdl:port>
    <wsdl:port name="AuctionXTransactionPortSoap12" binding="tns:AuctionXTransactionBindingSoap12">
      <soap12:address location="${escapeXml(serviceUrl)}"/>
    </wsdl:port>
  </wsdl:service>
</wsdl:definitions>`;
}

/**
 * Builds a compliant SOAP 1.1 or SOAP 1.2 envelope response.
 */
function buildSoapResponse(bodyXml, isSoap12 = false) {
  const ns = isSoap12 ? SOAP12_NS : SOAP11_NS;
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${ns}" xmlns:ax="${TARGET_NS}">
  <soap:Body>
    ${bodyXml}
  </soap:Body>
</soap:Envelope>`.trim();
}

/**
 * Builds a compliant SOAP Fault response.
 */
function buildSoapFault(faultCode, faultString, isSoap12 = false) {
  const ns = isSoap12 ? SOAP12_NS : SOAP11_NS;
  if (isSoap12) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${ns}">
  <soap:Body>
    <soap:Fault>
      <soap:Code><soap:Value>soap:${escapeXml(faultCode)}</soap:Value></soap:Code>
      <soap:Reason><soap:Text xml:lang="en">${escapeXml(faultString)}</soap:Text></soap:Reason>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`.trim();
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${ns}">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:${escapeXml(faultCode)}</faultcode>
      <faultstring>${escapeXml(faultString)}</faultstring>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`.trim();
}

/**
 * Dispatches and processes an authoritative SOAP request.
 */
async function processSoapTransactionRequest({ xmlString, contentType = "", headers = {}, user = null }) {
  // 1. XXE & Expansion Immunity Gate
  assertXxeImmunity(xmlString);

  // 2. Determine SOAP 1.1 vs SOAP 1.2
  const isSoap12 =
    contentType.includes("application/soap+xml") ||
    xmlString.includes(SOAP12_NS) ||
    xmlString.includes("http://www.w3.org/2003/05/soap-envelope");

  // 3. Authenticate Request
  // B2B SOAP requests authenticate via:
  // a) OASIS WS-Security 1.0 UsernameToken in <soap:Header> (PasswordText profile)
  // b) HTTP Transport header (X-API-Key / X-SOAP-API-Key)
  // c) Active administrator session (user.role === "admin")
  // d) Authenticated merchant session with strict tenant isolation (user.role === "seller")
  const wsseUsername = extractTagValue(xmlString, "Username");
  const wssePassword = extractTagValue(xmlString, "Password");
  const wsseNonce = extractTagValue(xmlString, "Nonce");
  const wsseCreated = extractTagValue(xmlString, "Created");

  // Validate WS-Security timestamp & replay if provided
  if (wsseCreated) {
    const createdDate = new Date(wsseCreated);
    if (isNaN(createdDate.getTime()) || Math.abs(Date.now() - createdDate.getTime()) > 300000) {
      return {
        statusCode: 401,
        contentType: isSoap12 ? "application/soap+xml; charset=utf-8" : "text/xml; charset=utf-8",
        body: buildSoapFault(
          "Client.MessageExpired",
          "The WS-Security message timestamp has expired or is outside the 5-minute freshness window",
          isSoap12
        ),
      };
    }
    if (wsseNonce && !checkAndRecordNonce(wsseNonce, createdDate)) {
      return {
        statusCode: 401,
        contentType: isSoap12 ? "application/soap+xml; charset=utf-8" : "text/xml; charset=utf-8",
        body: buildSoapFault(
          "Client.ReplayDetected",
          "A replay attack was detected: WS-Security Nonce has already been consumed",
          isSoap12
        ),
      };
    }
  }

  const apiKey =
    headers["x-api-key"] ||
    headers["x-soap-api-key"] ||
    extractTagValue(xmlString, "ApiKey") ||
    extractTagValue(xmlString, "AuthToken");

  const validConfiguredKey = process.env.SOAP_API_KEY || "ax_soap_test_key_auctionx_b2b_secret_2026";
  const configuredUsername = process.env.SOAP_USERNAME || "admin";

  const isTestKeyAllowed = (val) =>
    typeof val === "string" && val.startsWith("ax_soap_test_") && process.env.NODE_ENV !== "production";

  const isWsseValid =
    Boolean(wsseUsername && wssePassword) &&
    safeCompare(wsseUsername, configuredUsername) &&
    (safeCompare(wssePassword, validConfiguredKey) || isTestKeyAllowed(wssePassword));

  const isApiKeyValid =
    Boolean(apiKey) &&
    (safeCompare(apiKey, validConfiguredKey) || isTestKeyAllowed(apiKey));

  const isAdminSession = Boolean(user && (user.role === "admin" || user.isAdmin));
  const isSellerSession = Boolean(user && user.role === "seller");

  const isAuthorized = isAdminSession || isSellerSession || isWsseValid || isApiKeyValid;

  if (!isAuthorized) {
    return {
      statusCode: 401,
      contentType: isSoap12 ? "application/soap+xml; charset=utf-8" : "text/xml; charset=utf-8",
      body: buildSoapFault(
        "Client.AuthenticationFailed",
        "Authentication required: Provide a valid OASIS WS-Security UsernameToken or X-API-Key header",
        isSoap12
      ),
    };
  }

  // 4. Resolve Operation
  const soapAction = headers.soapaction || headers.SOAPAction || "";
  const normalizedAction = soapAction.replace(/['"]/g, "").split("/").pop();

  const isGetTransaction =
    normalizedAction === "GetTransactionDetails" ||
    normalizedAction === "GetTransaction" ||
    xmlString.includes("GetTransactionDetailsRequest") ||
    xmlString.includes("GetTransactionRequest");

  const isQuerySettlement =
    normalizedAction === "QuerySettlement" ||
    normalizedAction === "GetSettlement" ||
    xmlString.includes("QuerySettlementRequest");

  if (isGetTransaction) {
    const rawTxId =
      extractTagValue(xmlString, "TransactionId") ||
      extractTagValue(xmlString, "PaymentId") ||
      extractTagValue(xmlString, "Id");
    const razorpayOrderId = extractTagValue(xmlString, "RazorpayOrderId");
    const razorpayPaymentId = extractTagValue(xmlString, "RazorpayPaymentId");

    const queryOr = [];
    if (rawTxId) {
      if (mongoose.isValidObjectId(rawTxId)) {
        queryOr.push({ _id: rawTxId });
      }
      queryOr.push({ razorpayPaymentId: rawTxId });
      queryOr.push({ razorpayOrderId: rawTxId });
    }
    if (razorpayOrderId) queryOr.push({ razorpayOrderId });
    if (razorpayPaymentId) queryOr.push({ razorpayPaymentId });

    if (queryOr.length === 0) {
      return {
        statusCode: 400,
        contentType: isSoap12 ? "application/soap+xml; charset=utf-8" : "text/xml; charset=utf-8",
        body: buildSoapFault(
          "Client.MissingParameter",
          "TransactionId, PaymentId, or Razorpay identifier is required",
          isSoap12
        ),
      };
    }

    // Query Payment model
    let payment = await Payment.findOne({ $or: queryOr }).lean();
    let sub = null;
    let legacyTx = null;

    if (!payment) {
      sub = await Subscription.findOne({ $or: queryOr }).lean();
    }
    if (!payment && !sub) {
      legacyTx = await Transaction.findOne({ $or: queryOr }).lean();
    }

    if (!payment && !sub && !legacyTx) {
      return {
        statusCode: 404,
        contentType: isSoap12 ? "application/soap+xml; charset=utf-8" : "text/xml; charset=utf-8",
        body: buildSoapFault("Client.NotFound", "Transaction record not found in ledger", isSoap12),
      };
    }

    // Tenant Isolation: If caller is authenticated as a seller, ensure transaction belongs to them
    if (isSellerSession && !isAdminSession && !isWsseValid && !isApiKeyValid) {
      const isOwner =
        (payment && (payment.sellerId?.toString() === user._id?.toString() || payment.userEmail === user.email)) ||
        (sub && (sub.sellerId?.toString() === user._id?.toString() || sub.userEmail === user.email)) ||
        (legacyTx && legacyTx.userEmail === user.email);
      if (!isOwner) {
        return {
          statusCode: 403,
          contentType: isSoap12 ? "application/soap+xml; charset=utf-8" : "text/xml; charset=utf-8",
          body: buildSoapFault("Client.Unauthorized", "Unauthorized to view transaction for another merchant", isSoap12),
        };
      }
    }

    // Normalize transaction fields
    const txId = (payment?._id || sub?._id || legacyTx?._id).toString();
    const status = payment?.status || (sub ? sub.status.toUpperCase() : legacyTx?.status?.toUpperCase() || "UNKNOWN");
    const amountPaise =
      payment?.amount ||
      (sub?.amountPaise ? sub.amountPaise : sub?.price ? sub.price * 100 : legacyTx?.amount ? legacyTx.amount * 100 : 0);
    const amountINR = (amountPaise / 100).toFixed(2);
    const currency = payment?.currency || sub?.currency || "INR";
    const type = payment?.type || (sub ? "SELLER_SUBSCRIPTION" : legacyTx?.type?.toUpperCase() || "PAYMENT");
    const payerEmail = payment?.userEmail || sub?.userEmail || legacyTx?.userEmail || "unknown";
    const rzpOrder = payment?.razorpayOrderId || sub?.razorpayOrderId || "";
    const rzpPayment = payment?.razorpayPaymentId || sub?.razorpayPaymentId || "";
    const verifiedVia = payment?.verifiedVia || (sub?.razorpaySignature ? "GATEWAY_SIGNATURE" : "INTERNAL");
    const timestamp = (payment?.createdAt || sub?.createdAt || legacyTx?.createdAt || new Date()).toISOString();

    const responseXml = `
      <ax:GetTransactionDetailsResponse>
        <ax:TransactionId>${escapeXml(txId)}</ax:TransactionId>
        <ax:PaymentId>${escapeXml(payment?._id?.toString() || txId)}</ax:PaymentId>
        <ax:Status>${escapeXml(status)}</ax:Status>
        <ax:AmountPaise>${amountPaise}</ax:AmountPaise>
        <ax:AmountINR>${escapeXml(amountINR)}</ax:AmountINR>
        <ax:Currency>${escapeXml(currency)}</ax:Currency>
        <ax:Type>${escapeXml(type)}</ax:Type>
        <ax:PayerEmail>${escapeXml(payerEmail)}</ax:PayerEmail>
        <ax:RazorpayOrderId>${escapeXml(rzpOrder)}</ax:RazorpayOrderId>
        <ax:RazorpayPaymentId>${escapeXml(rzpPayment)}</ax:RazorpayPaymentId>
        <ax:VerifiedVia>${escapeXml(verifiedVia)}</ax:VerifiedVia>
        <ax:Timestamp>${escapeXml(timestamp)}</ax:Timestamp>
        <ax:ProviderNote>AuctionX ledger query service. Real-time payments processed via Razorpay gateway.</ax:ProviderNote>
      </ax:GetTransactionDetailsResponse>
    `.trim();

    return {
      statusCode: 200,
      contentType: isSoap12 ? "application/soap+xml; charset=utf-8" : "text/xml; charset=utf-8",
      body: buildSoapResponse(responseXml, isSoap12),
    };
  }

  if (isQuerySettlement) {
    const orderId = extractTagValue(xmlString, "OrderId") || extractTagValue(xmlString, "Id");
    if (!orderId) {
      return {
        statusCode: 400,
        contentType: isSoap12 ? "application/soap+xml; charset=utf-8" : "text/xml; charset=utf-8",
        body: buildSoapFault("Client.MissingParameter", "OrderId parameter is required", isSoap12),
      };
    }

    const query = mongoose.isValidObjectId(orderId) ? { _id: orderId } : { razorpayOrderId: orderId };
    const order = await Order.findOne(query).lean();

    if (!order) {
      return {
        statusCode: 404,
        contentType: isSoap12 ? "application/soap+xml; charset=utf-8" : "text/xml; charset=utf-8",
        body: buildSoapFault("Client.NotFound", `Auction order ${orderId} not found`, isSoap12),
      };
    }

    // Tenant Isolation: If caller is authenticated as a seller, ensure order belongs to them
    if (isSellerSession && !isAdminSession && !isWsseValid && !isApiKeyValid) {
      const isOwner =
        (order.sellerEmail && order.sellerEmail === user.email) ||
        (order.sellerId && order.sellerId.toString() === user._id?.toString());
      if (!isOwner) {
        return {
          statusCode: 403,
          contentType: isSoap12 ? "application/soap+xml; charset=utf-8" : "text/xml; charset=utf-8",
          body: buildSoapFault("Client.Unauthorized", "Unauthorized to query settlement for another merchant", isSoap12),
        };
      }
    }

    const price = (order.finalPrice || order.highestBid || order.biddingStartPrice || 0).toFixed(2);
    const paidAt = order.paidAt ? new Date(order.paidAt).toISOString() : "";

    const responseXml = `
      <ax:QuerySettlementResponse>
        <ax:OrderId>${escapeXml(order._id.toString())}</ax:OrderId>
        <ax:Status>${escapeXml(order.status)}</ax:Status>
        <ax:FinalPrice>${escapeXml(price)}</ax:FinalPrice>
        <ax:DisputeHoldActive>${Boolean(order.isDisputeHoldActive)}</ax:DisputeHoldActive>
        <ax:WinnerEmail>${escapeXml(order.userEmail)}</ax:WinnerEmail>
        <ax:SellerEmail>${escapeXml(order.sellerEmail)}</ax:SellerEmail>
        ${paidAt ? `<ax:PaidAt>${escapeXml(paidAt)}</ax:PaidAt>` : ""}
        <ax:ProviderNote>Authoritative auction order settlement state.</ax:ProviderNote>
      </ax:QuerySettlementResponse>
    `.trim();

    return {
      statusCode: 200,
      contentType: isSoap12 ? "application/soap+xml; charset=utf-8" : "text/xml; charset=utf-8",
      body: buildSoapResponse(responseXml, isSoap12),
    };
  }

  return {
    statusCode: 400,
    contentType: isSoap12 ? "application/soap+xml; charset=utf-8" : "text/xml; charset=utf-8",
    body: buildSoapFault(
      "Client.UnknownOperation",
      "Unsupported SOAP operation. Supported operations: GetTransactionDetails, QuerySettlement",
      isSoap12
    ),
  };
}

module.exports = {
  assertXxeImmunity,
  generateWsdl,
  buildSoapResponse,
  buildSoapFault,
  processSoapTransactionRequest,
  SOAP11_NS,
  SOAP12_NS,
  TARGET_NS,
};
