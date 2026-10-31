# AuctionX — Third-Party Notices and Licenses

> **Document Type:** Third-Party Open-Source and Vendor Attribution Document  
> **Target Release:** AuctionX — Public Source-Available Repository Release  
> **Document Status:** **`COMPILED DRAFT FOR RELEASE REVIEW`**  
> **Last Updated:** October 18, 2026  
> **Auditors:** DeepMind Agentic Security & Architecture Pair  
> **Target Repository:** `OM-SARDAR/Auction-X-Enhanced` (`AuctionX Monorepo`)  

---

## 1. Preamble and Legal Scope

AuctionX is open-source software governed by the **MIT License** (see [LICENSE](LICENSE)).

This document contains third-party open-source and vendor license notices, copyright statements, and attribution requirements for external libraries, fonts, icons, datasets, and media assets incorporated into, bundled with, or consumed by the AuctionX platform.

### Independent Third-Party Rights Notice
The AuctionX MIT license applies **solely to original source code and assets created for AuctionX**. It does not, and legally cannot, alter, supersede, or diminish your rights under the terms of any applicable third-party open-source or permissive license governing the components listed below. Each third-party component is governed strictly by its respective license terms.

---

## 2. Table of Third-Party Components by Ecosystem

```
+---------------------------------------------------------------------------------------------------------------+
| COMPONENT NAME                | EXACT VERSION | ECOSYSTEM / SCOPE  | APPLICABLE LICENSE                       |
+---------------------------------------------------------------------------------------------------------------+
| country-region-data           | 4.1.0         | Client (Bundled)   | MIT License                              |
| libphonenumber-js             | 1.12.6        | Client (Bundled)   | MIT License + Apache-2.0 Metadata        |
| gsap                          | 3.12.7        | Client (Bundled)   | Webflow Standard "No Charge" License     |
| @fortawesome/fontawesome-free | 6.7.2         | Client (Bundled)   | Multi-License (CC BY 4.0 / OFL 1.1 / MIT)|
| react-icons                   | 5.4.0         | Client (Bundled)   | Multi-Source (MIT, Apache-2.0, CC BY 3.0)|
| mdb-react-ui-kit              | 9.0.0         | Client (Bundled)   | MIT License (MDB Free)                   |
| lucide-react                  | 0.475.0       | Client (Bundled)   | ISC License (Lucide / Feather MIT)       |
| jspdf                         | 3.0.1         | Client (Bundled)   | MIT License                              |
| pdf-lib                       | 1.17.1        | Client (Bundled)   | MIT License                              |
| sweetalert2                   | 11.22.0       | Client (Bundled)   | MIT License                              |
| chart.js                      | 4.4.8         | Client (Bundled)   | MIT License                              |
| react & react-dom             | 18.3.1        | Client (Bundled)   | MIT License                              |
| @reduxjs/toolkit              | 2.6.1         | Client (Bundled)   | MIT License                              |
| axios                         | 1.10.0 (client)| Client (Bundled)  | MIT License                              |
| date-fns                      | 4.1.0         | Client (Bundled)   | MIT License                              |
| moment                        | 2.30.1        | Client (Bundled)   | MIT License                              |
| framer-motion                 | 12.4.1        | Client (Bundled)   | MIT License                              |
| clsx                          | 2.1.1         | Client (Bundled)   | MIT License                              |
| tailwind-merge                | 3.0.2         | Client (Bundled)   | MIT License                              |
| tailwindcss                   | 4.0.8         | Client (Bundled)   | MIT License                              |
| socket.io-client              | 4.8.1         | Client (Bundled)   | MIT License                              |
| validator                     | 13.12.0       | Client (Bundled)   | MIT License                              |
| lightningcss                  | 1.29.1        | Client (Build-Time)| Mozilla Public License 2.0 (MPL-2.0)     |
| dompurify                     | 3.2.4         | Client (Transitive)| Apache License 2.0 (Dual MPL-2.0/Apache) |
| express                       | 4.21.2        | Server (Backend)   | MIT License                              |
| mongoose                      | 8.14.0        | Server (Backend)   | MIT License                              |
| mongodb (driver)              | 6.16.0        | Server (Backend)   | Apache License 2.0                       |
| google-auth-library           | 9.15.1        | Server (Backend)   | Apache License 2.0                       |
| dotenv                        | 16.5.0        | Server (Backend)   | BSD-2-Clause License                     |
| nodemailer                    | 6.10.1        | Server (Backend)   | MIT-0 License                            |
| socket.io                     | 4.8.1         | Server (Backend)   | MIT License                              |
| bcrypt & bcryptjs             | 5.1.1 / 2.4.3 | Server (Backend)   | MIT License                              |
| jsonwebtoken                  | 9.0.2         | Server (Backend)   | MIT License                              |
| helmet                        | 8.1.0         | Server (Backend)   | MIT License                              |
| winston                       | 3.17.0        | Server (Backend)   | MIT License                              |
| pdfkit                        | 0.17.0        | Server (Backend)   | MIT License                              |
| multer                        | 1.4.5-lts.2   | Server (Backend)   | MIT License                              |
| passport                      | 0.7.0         | Server (Backend)   | MIT License                              |
| passport-google-oauth20       | 2.0.0         | Server (Backend)   | MIT License                              |
| fastapi                       | 0.121.0       | ML Service (Python)| MIT License                              |
| uvicorn                       | 0.38.0        | ML Service (Python)| BSD-3-Clause License                     |
| pymongo                       | 4.15.3        | ML Service (Python)| Apache License 2.0                       |
| numpy                         | 2.3.4         | ML Service (Python)| BSD-3-Clause License                     |
| redis                         | 7.0.1         | ML Service (Python)| MIT License                              |
| python-dotenv                 | 1.2.1         | ML Service (Python)| BSD-3-Clause License                     |
| dnspython                     | 2.8.0         | ML Service (Python)| ISC License                              |
| unDraw Illustrations          | N/A           | Client (Assets)    | unDraw License (Open Access)             |
+---------------------------------------------------------------------------------------------------------------+
```

---

## 3. Notable Client-Side Dependencies (Bundled Distributions)

### 3.1 `country-region-data`
- **Version:** `4.1.0`
- **Scope:** Bundled into client production bundle via [`client/src/utils/geoData.js`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/utils/geoData.js).
- **License:** MIT License
- **Copyright:** `Copyright (c) 2022 Benjamin Keen`
- **Notice Text:**
```text
The MIT License (MIT)

Copyright (c) 2022 Benjamin Keen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

### 3.2 `libphonenumber-js`
- **Version:** `1.12.6`
- **Scope:** Bundled into client production bundle via phone number verification inputs.
- **License:** MIT License (Parser Code) and Apache License 2.0 (Google Metadata Rules)
- **Copyright:**  
  - Code: `Copyright (c) 2016 @catamphetamine <purecatamphetamine@gmail.com>`
  - Metadata: `Copyright (C) 2009-2022 The Libphonenumber Authors, Google LLC`
- **Notice Text:**
```text
(The MIT License)

Copyright (c) 2016 @catamphetamine <purecatamphetamine@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---
Portions of phone metadata rules are derived from Google Android's libphonenumber:
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at:
    http://www.apache.org/licenses/LICENSE-2.0
```

---

### 3.3 `gsap` (GreenSock Animation Platform)
- **Version:** `3.12.7`
- **Scope:** Bundled into client production bundle via `TextPlugin` ([`GreetingAnimation.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Common/GreetingAnimation/GreetingAnimation.jsx)) and `ScrollTrigger` ([`Home.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/pages/User/Home.jsx)).
- **License:** Webflow Standard "No Charge" GSAP License (`https://gsap.com/standard-license`)
- **Copyright:** `Copyright 2008-2025, GreenSock Inc. / Webflow Inc. All rights reserved.`
- **Permitted Use Scope:** Webflow grants a non-exclusive, worldwide, no-charge license to use, reproduce, display, and implement GSAP products on any website, web application, or digital interface. Use in AuctionX is a Permitted Use.
- **Notice & Attribution Text:**
```text
GSAP (GreenSock Animation Platform)
Version 3.12.7 — https://gsap.com

Copyright 2008-2025, GreenSock Inc. / Webflow Inc. All rights reserved.
Subject to the terms of the Standard "No Charge" GSAP License at:
https://gsap.com/standard-license

Use is permitted on websites and web applications at no charge. 
Implementation in visual animation building tools that compete directly 
with Webflow is prohibited. Reverse engineering and proprietary notice 
removal are prohibited.
```

---

### 3.4 `@fortawesome/fontawesome-free`
- **Version:** `6.7.2`
- **Scope:** Bundled into client production bundle via [`ShareMenu.jsx`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/components/Common/MiniComponent/ShareMenu/ShareMenu.jsx) and `@fortawesome/react-fontawesome`.
- **License:** Tri-Licensed (CC BY 4.0 / SIL OFL 1.1 / MIT)
- **Copyright:** `Copyright 2024 Fonticons, Inc. (https://fontawesome.com)` with Reserved Font Name: `"Font Awesome"`.
- **Tripartite Notice Text:**
```text
Font Awesome Free 6.7.2
Fonticons, Inc. — https://fontawesome.com

1. Icons (SVG & JS File Types):
   Licensed under Creative Commons Attribution 4.0 International (CC BY 4.0)
   https://creativecommons.org/licenses/by/4.0/

2. Fonts (Web and Desktop Font Files):
   Licensed under SIL Open Font License 1.1 (SIL OFL 1.1)
   Copyright (c) 2024 Fonticons, Inc. with Reserved Font Name: "Font Awesome".
   http://scripts.sil.org/OFL
   Fonts and derivatives may not be sold by themselves and must retain attribution.

3. Code (CSS, Less, SCSS, JS Build Scripts):
   Licensed under the MIT License:
   Copyright 2024 Fonticons, Inc.

4. Brand Icons:
   All brand logos are trademarks of their respective owners. Brand icons must 
   only be used to represent the company, product, or service to which they refer.
```

---

### 3.5 `react-icons` (Upstream Icon Sets)
- **Version:** `5.4.0`
- **Scope:** Bundled into client production bundle.
- **Wrapper License:** MIT License, `Copyright 2018 kamijin_fanta <kamijin@live.jp>`.
- **Specific Upstream Icon Sets Utilized in AuctionX:**
  1. **`react-icons/fa` (Font Awesome 5):**
     - Icons: Creative Commons Attribution 4.0 International (CC BY 4.0).
     - Upstream Author: Fonticons, Inc. (`https://fontawesome.com`).
  2. **`react-icons/md` (Google Material Design Icons):**
     - License: Apache License Version 2.0.
     - Upstream Author: Google LLC (`https://github.com/google/material-design-icons`).
  3. **`react-icons/io` & `react-icons/io5` (Ionicons):**
     - License: MIT License.
     - Upstream Author: Ionic Team (`https://ionicons.com`).
  4. **`react-icons/im` (IcoMoon Free):**
     - License: Creative Commons Attribution 4.0 International (CC BY 4.0).
     - Upstream Author: Keyamoon (`https://github.com/Keyamoon/IcoMoon-Free`).
  5. **`react-icons/ri` (Remix Icon):**
     - License: Apache License Version 2.0.
     - Upstream Author: Remix Design (`https://remixicon.com`).
  6. **`react-icons/bi` (BoxIcons):**
     - License: MIT License.
     - Upstream Author: Atisawd (`https://boxicons.com`).
  7. **`react-icons/gi` (Game Icons) — ATTRIBUTION REQUIRED:**
     - License: **Creative Commons Attribution 3.0 Unported (CC BY 3.0)** (`https://creativecommons.org/licenses/by/3.0/`).
     - Upstream Authors: Delapouite, Lorc, and contributors (`https://game-icons.net`).
     - Specific Icons Used: Hourglass / Sands of Time (`GiSandsOfTime` in `ProductList7.jsx` and `ProductList9.jsx`).
     - Required Attribution: *"Icons made by Delapouite and Lorc from https://game-icons.net, licensed under CC BY 3.0."*

---

### 3.6 `mdb-react-ui-kit`
- **Version:** `9.0.0`
- **Scope:** Bundled into client production bundle.
- **License:** MIT License for MDB Free
- **Copyright:** `MDBootstrap (https://mdbootstrap.com)`
- **Notice Text:**
```text
MIT license for MDB Free
Copyright (c) MDBootstrap

Free packages are available under the MIT License.
Permission is hereby granted, free of charge, to any person obtaining a copy 
of this software and associated documentation files (the "Software"), to deal 
in the Software without restriction...
The above copyright notice and this permission notice shall be included in all 
copies or substantial portions of the Software.
```

---

### 3.7 `lucide-react`
- **Version:** `0.475.0`
- **Scope:** Bundled into client production bundle.
- **License:** ISC License
- **Copyright:** `Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.`
- **Notice Text:**
```text
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). 
All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.
```

---

### 3.8 `jspdf` & `pdf-lib`
- **`jspdf` (3.0.1):**
  - License: MIT License
  - Copyright: `Copyright (c) 2010-2021 James Hall (https://github.com/MrRio/jsPDF), Copyright (c) 2015-2021 yWorks GmbH (https://www.yworks.com/)`
- **`pdf-lib` (1.17.1):**
  - License: MIT License
  - Copyright: `Copyright (c) 2019 Andrew Dillon`

---

### 3.9 `sweetalert2`
- **Version:** `11.22.0`
- **License:** MIT License
- **Copyright:** `Copyright (c) 2014 Tristan Edwards & Limon Monte`

---

### 3.10 Core React Ecosystem Libraries
- **`react` & `react-dom` (18.3.1):** MIT License, `Copyright (c) Meta Platforms, Inc. and affiliates.`
- **`@reduxjs/toolkit` (2.6.1):** MIT License, `Copyright (c) 2018 Mark Erikson`
- **`axios` (1.10.0 / 1.9.0):** MIT License, `Copyright (c) 2014-present Matt Zabriskie`
- **`date-fns` (4.1.0):** MIT License, `Copyright (c) 2021 Sasha Koss and Lesha Koss`
- **`moment` (2.30.1):** MIT License, `Copyright (c) JS Foundation and other contributors`
- **`framer-motion` (12.4.1):** MIT License, `Copyright (c) 2018 Framer B.V.`
- **`tailwindcss` (4.0.8):** MIT License, `Copyright (c) Tailwind Labs, Inc.`
- **`socket.io-client` (4.8.1):** MIT License, `Copyright (c) 2014-2024 Automattic <dev@cloudup.com>`
- **`validator` (13.12.0):** MIT License, `Copyright (c) 2018 Chris O'Hara <cohara87@gmail.com>`

---

## 4. Build-Time and Compiler Dependencies (Non-Distributed Runtime)

The following dependencies are executed during application compilation or styling and their engine binaries are **not distributed** in browser object code:

### 4.1 `lightningcss`
- **Version:** `1.29.1`
- **Scope:** Transitive dependency of `@tailwindcss/vite` / `@tailwindcss/postcss`.
- **License:** Mozilla Public License 2.0 (MPL-2.0)
- **Copyright:** `Copyright (c) 2022-present Devon Govett`
- **Distribution Status:** Build-time Rust CSS engine executed locally/in CI. It is not included in the client runtime bundle or delivered to web browsers. MPL-2.0 source disclosure obligations apply only to modifications of `lightningcss` source files, which AuctionX does not alter.

### 4.2 `dompurify`
- **Version:** `3.2.4`
- **Scope:** Transitive dependency of `jspdf`.
- **License:** Dual-licensed under `MPL-2.0 OR Apache-2.0`.
- **Applicable Election:** AuctionX utilizes `dompurify` under the terms of the **Apache License 2.0**.
- **Copyright:** `Copyright 2014-2024 Cure53 and DOMPurify contributors`.

---

## 5. Server-Side Production Dependencies (Backend Hosted Runtime)

The following dependencies run within the Node.js server container and are governed by permissive licenses:

### 5.1 `mongodb` (Official Node.js Driver)
- **Version:** `6.16.0` (via `mongoose@8.14.0`)
- **License:** Apache License 2.0
- **Copyright:** `Copyright (c) 2012-present MongoDB Inc.`
- **Notice Text:**
```text
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at:
    http://www.apache.org/licenses/LICENSE-2.0
```

### 5.2 `google-auth-library`
- **Version:** `9.15.1`
- **License:** Apache License 2.0
- **Copyright:** `Copyright (c) 2014-2024 Google LLC.`

### 5.3 `dotenv`
- **Version:** `16.5.0`
- **License:** BSD-2-Clause License
- **Copyright:** `Copyright (c) 2015, Scott Motte. All rights reserved.`
- **Notice Text:**
```text
Redistribution and use in source and binary forms, with or without modification, 
are permitted provided that the following conditions are met:
1. Redistributions of source code must retain the above copyright notice, this 
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this 
   list of conditions and the following disclaimer in the documentation and/or 
   other materials provided with the distribution.
```

### 5.4 `nodemailer`
- **Version:** `6.10.1`
- **License:** MIT-0 (MIT No Attribution License)
- **Copyright:** `Copyright (c) 2011-2023 Andris Reinman`

### 5.5 Other Server Permissive Dependencies
- **`express` (4.21.2):** MIT License, `Copyright (c) 2009-2014 TJ Holowaychuk <tj@vision-media.ca>, Copyright (c) 2013-2014 Roman Shtylman <shtylman+expressjs@gmail.com>, Copyright (c) 2014-2015 Douglas Christopher Wilson <doug@somethingdoug.com>`
- **`mongoose` (8.14.0):** MIT License, `Copyright (c) 2010 LearnBoost <dev@learnboost.com>`
- **`socket.io` (4.8.1):** MIT License, `Copyright (c) 2014-2024 Automattic <dev@cloudup.com>`
- **`bcrypt` (5.1.1):** MIT License, `Copyright (c) 2010 Nick Campbell`
- **`jsonwebtoken` (9.0.2):** MIT License, `Copyright (c) 2015 Auth0, Inc. <support@auth0.com>`
- **`helmet` (8.1.0):** MIT License, `Copyright (c) 2012-2024 Evan Hahn, Adam Baldwin`
- **`winston` (3.17.0):** MIT License, `Copyright (c) 2010 Charlie Robbins`
- **`pdfkit` (0.17.0):** MIT License, `Copyright (c) 2012 Devon Govett`

---

## 6. Recommendation Microservice Dependencies (Python Runtime)

All dependencies executing within the FastAPI recommendation microservice are permissive open-source libraries:

- **`fastapi` (0.121.0):** MIT License, `Copyright (c) 2018 Sebastián Ramírez`
- **`uvicorn` (0.38.0):** BSD-3-Clause License, `Copyright (c) 2017-present, Encode OSS Ltd. All rights reserved.`
- **`pymongo` (4.15.3):** Apache License 2.0, `Copyright 2009-present MongoDB, Inc.`
- **`numpy` (2.3.4):** BSD-3-Clause License, `Copyright (c) 2005-2025, NumPy Developers. All rights reserved.`
- **`redis` (7.0.1):** MIT License, `Copyright (c) Redis Ltd.`
- **`python-dotenv` (1.2.1):** BSD-3-Clause License, `Copyright (c) 2014, Saurabh Kumar`
- **`dnspython` (2.8.0):** ISC License, `Copyright (C) Dnspython Contributors`

---

## 7. Vector Illustrations and Artwork

### 7.1 unDraw Open Access Illustrations
- **Files:**  
  - [`client/src/assets/images/Pages/Login/log.svg`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/assets/images/Pages/Login/log.svg) (`<title>maker launch</title>`)
  - [`client/src/assets/images/Pages/Login/register.svg`](file:///d:/THE%20OMS%20DEVS/WEB%20DEVS/MERN%20PROJECTS/PCMT/SEM%206/OMS/Auction%20X%20%E2%9C%85/client/src/assets/images/Pages/Login/register.svg) (`<title>press play</title>`)
- **Author:** Katerina Limpitsouni (`https://undraw.co`)
- **License:** unDraw Open License (`https://undraw.co/license`)
- **Terms:** Free for personal and commercial projects. Can be used without attribution or cost. Cannot be compiled to replicate a competing illustration distribution service.

---

## 8. Nominative Trademark and Brand Fair-Use Disclaimers

AuctionX includes standard brand icons and logo assets solely for user interface representation, payment identification, and social link navigation:

1. **Payment Provider Logos (`Gpay.png`, `PhonePe.png`, etc.):**  
   Google Pay and PhonePe are registered trademarks of Google LLC and PhonePe Private Limited respectively. Use in AuctionX is strictly nominative to indicate accepted payment gateways. No sponsorship, endorsement, or commercial affiliation is claimed.
2. **Social Media Icons (`github-logo.png`, `twitter.png`, `instagram.png`, `linkedin.png`, `facebook.png`):**  
   GitHub, X/Twitter, Instagram, LinkedIn, and Facebook are trademarks of their respective corporate owners. Use in AuctionX is solely to direct users to corresponding social profiles.
3. **Web Font Trademarks:**  
   "Font Awesome" is a Reserved Font Name owned by Fonticons, Inc.

---

## 9. Notice Inquiries and Maintenance

For inquiries regarding third-party licensing or to report missing attribution notices, contact the AuctionX project maintainers through the official security contact channel designated in `SECURITY.md`.
