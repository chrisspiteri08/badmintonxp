"use strict";
// cPanel startup file. Passenger/LiteSpeed owns process lifecycle and socket mapping.
process.env.NODE_ENV = "production";
process.env.HOSTNAME = "0.0.0.0";
process.env.NEXT_TELEMETRY_DISABLED = "1";
// Leave PORT unchanged. Next's generated server uses PORT or its default 3000.
require("./runtime/server.js");
