const { graphql, parse, validate } = require("graphql");
const schema = require("./schema");
const resolvers = require("./resolvers");
const { logger } = require("../../../infrastructure/logging/loggerMiddleware");
const adminAuthMiddleware = require("../../admin/authentication/middleware/authAdminMiddleware");

const MAX_QUERY_DEPTH = 6;
const MAX_QUERY_LENGTH = 10000; // 10 KB query string limit
const MAX_SELECTION_COUNT = 150; // Maximum field selections per operation
const MAX_ALIASES = 15; // Maximum field aliases per operation

/**
 * Recursive query AST depth calculator to prevent query complexity abuse.
 */
function calculateDepth(node, currentDepth = 0) {
  if (!node) return currentDepth;

  if (node.definitions && Array.isArray(node.definitions)) {
    let maxDefDepth = currentDepth;
    for (const def of node.definitions) {
      const d = calculateDepth(def, currentDepth);
      if (d > maxDefDepth) maxDefDepth = d;
    }
    return maxDefDepth;
  }

  if (node.selectionSet && node.selectionSet.selections) {
    let maxChildDepth = currentDepth;
    for (const selection of node.selectionSet.selections) {
      // Don't count introspection fields towards depth limits
      if (selection.name && selection.name.value.startsWith("__")) {
        continue;
      }
      const childDepth = calculateDepth(selection, currentDepth + 1);
      if (childDepth > maxChildDepth) {
        maxChildDepth = childDepth;
      }
    }
    return maxChildDepth;
  }

  return currentDepth;
}

/**
 * Recursive query AST counter for selections and aliases to prevent alias explosion DoS.
 */
function countSelectionsAndAliases(node, counters = { selections: 0, aliases: 0 }) {
  if (!node) return counters;

  if (node.definitions && Array.isArray(node.definitions)) {
    for (const def of node.definitions) {
      countSelectionsAndAliases(def, counters);
    }
    return counters;
  }

  if (node.selectionSet && node.selectionSet.selections) {
    for (const selection of node.selectionSet.selections) {
      counters.selections += 1;
      if (selection.alias) {
        counters.aliases += 1;
      }
      countSelectionsAndAliases(selection, counters);
    }
  }

  return counters;
}

/**
 * GraphQL Handler Middleware — Stage 7.42 / Stage 7.43 Hardening
 * Authenticates admin requests, limits query depth, enforces complexity/alias bounds,
 * disables production introspection, executes queries, and sanitizes errors.
 */
const graphqlHandler = async (req, res) => {
  try {
    const { query, variables, operationName } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        errors: [{ message: "GraphQL query is required and must be a string." }],
      });
    }

    // 0. Enforce maximum query string size
    if (query.length > MAX_QUERY_LENGTH) {
      return res.status(400).json({
        errors: [
          {
            message: `Query length of ${query.length} exceeds maximum limit of ${MAX_QUERY_LENGTH} characters.`,
          },
        ],
      });
    }

    // 1. Parse AST and check query complexity bounds
    let documentAST;
    try {
      documentAST = parse(query);
    } catch (parseError) {
      return res.status(400).json({
        errors: [{ message: `GraphQL Syntax Error: ${parseError.message}` }],
      });
    }

    // Check query depth
    const depth = calculateDepth(documentAST);
    if (depth > MAX_QUERY_DEPTH) {
      return res.status(400).json({
        errors: [
          {
            message: `Query depth of ${depth} exceeds maximum allowed depth of ${MAX_QUERY_DEPTH}.`,
          },
        ],
      });
    }

    // Check selection and alias complexity
    const { selections, aliases } = countSelectionsAndAliases(documentAST);
    if (selections > MAX_SELECTION_COUNT) {
      return res.status(400).json({
        errors: [
          {
            message: `Total field selection count (${selections}) exceeds maximum allowed of ${MAX_SELECTION_COUNT}.`,
          },
        ],
      });
    }

    if (aliases > MAX_ALIASES) {
      return res.status(400).json({
        errors: [
          {
            message: `Total alias count (${aliases}) exceeds maximum allowed of ${MAX_ALIASES}.`,
          },
        ],
      });
    }

    // Restrict introspection in production unless explicitly enabled
    const isProduction = process.env.NODE_ENV === "production";
    const allowIntrospection = process.env.ENABLE_GRAPHQL_INTROSPECTION === "true";
    if (isProduction && !allowIntrospection) {
      const hasIntrospection = documentAST.definitions?.some((def) => {
        if (def.selectionSet && def.selectionSet.selections) {
          return def.selectionSet.selections.some(
            (sel) => sel.name && sel.name.value && sel.name.value.startsWith("__")
          );
        }
        return false;
      });
      if (hasIntrospection) {
        return res.status(400).json({
          errors: [{ message: "GraphQL schema introspection is disabled in production." }],
        });
      }
    }

    // 2. Validate against schema
    const validationErrors = validate(schema, documentAST);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        errors: validationErrors.map((err) => ({ message: err.message })),
      });
    }

    // 3. Context containing authenticated administrative user
    const contextValue = {
      req,
      res,
      admin: req.admin || req.user || null,
      userId: req.userId || null,
      role: req.role || null,
    };

    // 4. Execute query
    const result = await graphql({
      schema,
      source: query,
      rootValue: resolvers,
      contextValue,
      variableValues: variables,
      operationName,
    });

    // 5. Sanitize errors to ensure internal stack traces / db errors are never leaked
    if (result.errors && result.errors.length > 0) {
      const sanitizedErrors = result.errors.map((err) => {
        logger.error("GraphQL Execution Error:", {
          message: err.message,
          path: err.path,
          operationName,
        });

        const isAuthError =
          err.message.includes("Access denied") ||
          err.message.includes("Unauthorized") ||
          err.message.includes("Authentication required");

        return {
          message: isAuthError
            ? err.message
            : process.env.NODE_ENV === "production"
            ? "An error occurred while executing the query."
            : err.message,
          path: err.path,
          locations: err.locations,
        };
      });

      return res.status(200).json({
        data: result.data || null,
        errors: sanitizedErrors,
      });
    }

    return res.status(200).json(result);
  } catch (err) {
    logger.error("GraphQL Server Fatal Error:", { error: err.message });
    return res.status(500).json({
      errors: [
        {
          message:
            process.env.NODE_ENV === "production"
              ? "Internal server error during GraphQL execution."
              : err.message,
        },
      ],
    });
  }
};

module.exports = {
  graphqlHandler,
};
