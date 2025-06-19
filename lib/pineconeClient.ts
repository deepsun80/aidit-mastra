import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config();

const PINECONE_API_KEY = process.env.PINECONE_API_KEY!;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME!;
const PINECONE_REGULATION_INDEX_NAME =
  process.env.PINECONE_REGULATION_INDEX_NAME!;

// 🌐 Main Pinecone connection
const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });

// ✅ Existing default index (used in tools and agents)
export const pineconeIndex = pinecone.index(PINECONE_INDEX_NAME);

// ✅ New regulatory index
export const pineconeRegulationIndex = pinecone.index(
  PINECONE_REGULATION_INDEX_NAME
);
