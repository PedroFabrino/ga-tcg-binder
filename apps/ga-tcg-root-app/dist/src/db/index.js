"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.client = void 0;
exports.createInMemoryDb = createInMemoryDb;
const client_1 = require("@libsql/client");
const libsql_1 = require("drizzle-orm/libsql");
const schema = __importStar(require("./schema"));
if (typeof process !== "undefined" && typeof process.loadEnvFile === "function") {
    if (!process.env.TURSO_DATABASE_URL) {
        try {
            process.loadEnvFile(".env.local");
        }
        catch { }
        try {
            process.loadEnvFile(".env");
        }
        catch { }
    }
}
const databaseUrl = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
exports.client = (0, client_1.createClient)({
    url: databaseUrl,
    authToken: authToken,
});
exports.db = (0, libsql_1.drizzle)(exports.client, { schema });
// Helper to create an in-memory database instance for isolated tests
function createInMemoryDb() {
    const memClient = (0, client_1.createClient)({
        url: ":memory:",
    });
    const memDb = (0, libsql_1.drizzle)(memClient, { schema });
    return { client: memClient, db: memDb };
}
