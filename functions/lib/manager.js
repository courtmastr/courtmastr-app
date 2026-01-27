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
exports.getBracketsManager = getBracketsManager;
const brackets_manager_1 = require("brackets-manager");
const firestore_adapter_1 = require("./storage/firestore-adapter");
const admin = __importStar(require("firebase-admin"));
/**
 * Creates a BracketsManager instance scoped to a specific tournament.
 *
 * @param tournamentId The ID of the tournament context.
 * @returns A fully configured BracketsManager instance.
 */
function getBracketsManager(tournamentId) {
    const db = admin.firestore();
    // Use the tournament document as the root (even components)
    // Sub-collections will be created under it: tournaments/T1/participant, tournaments/T1/match, etc.
    const rootPath = `tournaments/${tournamentId}`;
    const storage = new firestore_adapter_1.FirestoreStorage(db, rootPath);
    return new brackets_manager_1.BracketsManager(storage);
}
//# sourceMappingURL=manager.js.map