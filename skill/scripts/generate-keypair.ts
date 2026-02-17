import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const keypair = Keypair.generate();
console.log(JSON.stringify({
  publicKey: keypair.publicKey.toBase58(),
  privateKey: bs58.encode(keypair.secretKey),
}, null, 2));
