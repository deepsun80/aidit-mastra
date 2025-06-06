import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config();

const PINECONE_API_KEY = process.env.PINECONE_API_KEY!;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME!;

const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
export const pineconeIndex = pinecone.index(PINECONE_INDEX_NAME);
