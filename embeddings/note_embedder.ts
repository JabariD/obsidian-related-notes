import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import * as fs from 'fs/promises';
const path = require('path');

/**
 * Represents a note with a title and content.
 */
interface Note {
  title: string;
  content: string;
}

/**
 * A class for embedding and managing notes using LangChain and MemoryVectorStore.
 */
class NoteEmbedder {
  private embeddings: OpenAIEmbeddings;
  private vectorStore: MemoryVectorStore | null = null;

  /**
   * Creates a new NoteEmbedder instance.
   * @param apiKey - The OpenAI API key for creating embeddings.
   */
  constructor(apiKey: string) {
    this.embeddings = new OpenAIEmbeddings({ openAIApiKey: apiKey });
  }

  /**
   * Adds a new note to the vector store.
   * @param note - The note to be added.
   * @throws Error if there's an issue adding the note.
   */
  async addNote(note: Note): Promise<void> {
    const doc = new Document({
      pageContent: note.content,
      metadata: { title: note.title }
    });

    try {
      if (!this.vectorStore) {
        this.vectorStore = await MemoryVectorStore.fromDocuments([doc], this.embeddings);
      } else {
        await this.vectorStore.addDocuments([doc]);
      }
    } catch (error) {
      throw new Error(`Failed to add note: ${error.message}`);
    }
  }

  /**
* Searches for notes similar to the given query and returns them with their similarity scores.
* @param query - The search query.
* @param k - The number of results to return (default: 5).
* @returns An array of tuples containing notes and their similarity scores.
* @throws Error if no notes have been added yet.
*/
  async searchNotes(query: string, k: number = 5): Promise<[Note, number][]> {
    if (!this.vectorStore) {
      throw new Error("No notes have been added yet");
    }

    try {
      const results = await this.vectorStore.similaritySearchWithScore(query, k);
      return results.map(([doc, score]: [Document, number]) => [{
        title: doc.metadata.title as string,
        content: doc.pageContent
      }, score]);
    } catch (error) {
      throw new Error(`Failed to search notes: ${error.message}`);
    }
  }

  /**
   * Saves the current vector store to a file.
   * @param filePath - The path where the file should be saved.
   * @throws Error if no notes have been added or if saving fails.
   */
  async saveToFile(filePath: string): Promise<void> {
    if (!this.vectorStore) {
      throw new Error("No notes have been added yet");
    }

    try {
      const directory = path.dirname(filePath);
      await fs.mkdir(directory, { recursive: true });
      const data = JSON.stringify(this.vectorStore);
      await fs.writeFile(filePath, data, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save vector store to file: ${error.message}`);
    }
  }

  /**
   * Loads the vector store from a file.
   * @param filePath - The path of the file to load from.
   * @throws Error if loading fails.
   */
  async loadFromFile(filePath: string): Promise<void> {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const vectorStoreData = JSON.parse(data);
      
      // Reconstruct the MemoryVectorStore
      this.vectorStore = new MemoryVectorStore(this.embeddings);
      
      // Add the documents to the reconstructed vector store
      const documents = vectorStoreData.memoryVectors.map((vector: any) => 
        new Document({
          pageContent: vector.content,
          metadata: { title: vector.metadata.title }
        })
      );
      
      await this.vectorStore.addDocuments(documents);
    } catch (error) {
      throw new Error(`Failed to load vector store from file: ${error.message}`);
    }
  }
}

export { NoteEmbedder };
export type { Note };
