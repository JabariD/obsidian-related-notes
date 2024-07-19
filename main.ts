import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, ItemView, TFile, TAbstractFile } from 'obsidian';
import * as path from 'path';


// Interface for embedding data
interface EmbeddingData {
	[filePath: string]: number[];
  }
  
  // Class to manage embeddings
  class EmbeddingManager {
	plugin: SimilarNotesPlugin;
  
	constructor(plugin: SimilarNotesPlugin) {
	  this.plugin = plugin;
	}
  
	// Function to get the embedding directory
	getEmbeddingDir(): string {
	  return `${this.plugin.app.vault.configDir}/plugins/obsidian-related-notes/embeddings`;
	}
  
	// Function to generate embeddings (placeholder, will be implemented later)
	async generateEmbeddings(text: string): Promise<number[]> {
	  // TODO: Implement actual embedding generation using TF-IDF or other techniques
	  // For now, return a dummy embedding vector
	  return Array(1536).fill(0); // Return a dummy embedding vector of length 1536 (for text-embedding-ada-002)
	}
  
	// Function to save embeddings to a file
	async saveEmbeddings(filePath: string, embeddings: number[]): Promise<void> {
	  const embeddingDir = this.getEmbeddingDir();
	  const file = path.join(embeddingDir, btoa(filePath) + '.json'); // Use path.join to handle special characters in file names
  
	  if (!await this.plugin.app.vault.adapter.exists(embeddingDir)) {
		await this.plugin.app.vault.adapter.mkdir(embeddingDir);
	  }
  
	  await this.plugin.app.vault.adapter.write(file, JSON.stringify(embeddings));
	}

	// Function to load embeddings from a file
	async loadEmbeddings(filePath: string): Promise<number[] | null> {
	  const file = `${this.getEmbeddingDir()}/${btoa(filePath)}.json`; // Base64 encode the file path
  
	  if (await this.plugin.app.vault.adapter.exists(file)) {
		const embeddings = await this.plugin.app.vault.adapter.read(file);
		return JSON.parse(embeddings);
	  }
	  return null;
	}
  
	// Function to update embeddings for all notes
	async updateAllEmbeddings(): Promise<void> {
	  const { vault } = this.plugin.app;
	  const { excludedFilesAndFolders } = this.plugin.settings;
	  const files = vault.getMarkdownFiles();
  
	  for (let i = 0; i < files.length; i++) {
		const file = files[i];
  
		// Check if the file or its parent folders are excluded
		if (this.isFileExcluded(file, excludedFilesAndFolders)) {
		  continue;
		}
  
		const content = await vault.cachedRead(file);
		const embeddings = await this.generateEmbeddings(content);
		await this.saveEmbeddings(file.path, embeddings);
	  }
  
	  new Notice('Embeddings updated for all notes!');
	}
  
	// Helper function to check if a file is excluded based on settings
	isFileExcluded(file: TFile, excludedFilesAndFolders: string[]): boolean {
	  return excludedFilesAndFolders.some((excludedPath) => {
		const fullExcludedPath = excludedPath.startsWith('/') ? excludedPath : `/${excludedPath}`; // Add leading slash if missing
		return file.path.startsWith(fullExcludedPath);
	  });
	}
  }


// Interface for plugin settings
interface SimilarNotesPluginSettings {
	openaiApiKey: string;
	indexRefreshRate: 'manual' | 'always' | 'onNewNote';
	excludedFilesAndFolders: string[];
	numberOfResults: number;
	embeddingModel: string;
}

// Default settings
const DEFAULT_SETTINGS: SimilarNotesPluginSettings = {
	openaiApiKey: '',
	indexRefreshRate: 'manual',
	excludedFilesAndFolders: [],
	numberOfResults: 50,
	embeddingModel: 'text-embedding-ada-002', // Default embedding model
};

// Plugin class
export default class SimilarNotesPlugin extends Plugin {
	settings: SimilarNotesPluginSettings;
	embeddingManager: EmbeddingManager;
	// ... (Add other variables like embedding cache here later)

	async onload() {
		await this.loadSettings();
		this.embeddingManager = new EmbeddingManager(this);

		// Register the view
		this.registerView(
			VIEW_TYPE_SIMILAR_NOTES,
			(leaf) => new SimilarNotesView(leaf, this)
		);

		// Add a ribbon icon to activate the view
		this.addRibbonIcon('dice', 'Similar Notes', () => {
			this.activateView();
		});

		// Register settings tab
		this.addSettingTab(new SimilarNotesSettingTab(this.app, this));

		// Add a command to generate and store embeddings for the active note
		this.addCommand({
			id: 'generate-and-store-embeddings',
			name: 'Generate & Store Embeddings (Active Note)',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
			  const activeFile = this.app.workspace.getActiveFile();
			  if (activeFile) {
				await this.generateAndStoreEmbeddingsForFile(activeFile);
				new Notice(`Embeddings generated and stored for ${activeFile.path}`);
			  } else {
				new Notice('No active file found.');
			  }
			},
		  });

		// Add a command to load and display embeddings for the active note
		this.addCommand({
			id: 'load-and-display-embeddings',
			name: 'Load & Display Embeddings (Active Note)',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
			  const activeFile = this.app.workspace.getActiveFile();
			  if (activeFile) {
				const embeddings = await this.embeddingManager.loadEmbeddings(activeFile.path);
				if (embeddings) {
				  new Notice(`Embeddings for ${activeFile.path}:\n${JSON.stringify(embeddings)}`);
				} else {
				  new Notice(`No embeddings found for ${activeFile.path}`);
				}
			  } else {
				new Notice('No active file found.');
			  }
			},
		  });
	}

	onunload() {
		// ... (Cleanup if needed)
	}

	// Method to load settings
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	// Method to save settings
	async saveSettings() {
		await this.saveData(this.settings);
	}

	// Helper function to activate the view
	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_SIMILAR_NOTES);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Our view could not be found in the workspace, create a new leaf
			// in the right sidebar for it
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: VIEW_TYPE_SIMILAR_NOTES, active: true });
			}
		}

		// "Reveal" the leaf in case it is in a collapsed sidebar
		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	// Helper function to generate and store embeddings for a given file
	async generateAndStoreEmbeddingsForFile(file: TAbstractFile): Promise<void> {
		if (file instanceof TFile) {
		  const content = await this.app.vault.cachedRead(file);
		  const embeddings = await this.embeddingManager.generateEmbeddings(content);
		  await this.embeddingManager.saveEmbeddings(file.path, embeddings);
		}
	  }
}

// Constant for the view type
export const VIEW_TYPE_SIMILAR_NOTES = 'similar-notes-view';

// View class
export class SimilarNotesView extends ItemView {
  plugin: SimilarNotesPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: SimilarNotesPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE_SIMILAR_NOTES;
  }

  getDisplayText() {
    return 'Similar Notes';
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.createEl('h2', { text: 'Similar Notes' });

    // ... (Add code to fetch and display similar notes here later)
  }

  async onClose() {
    // ... (Cleanup any elements or data here)
  }
}

// Settings tab for configuring the plugin
class SimilarNotesSettingTab extends PluginSettingTab {
	plugin: SimilarNotesPlugin;

	constructor(app: App, plugin: SimilarNotesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc('Enter your OpenAI API key')
			.addText((text) =>
				text
					.setPlaceholder('Your API key')
					.setValue(this.plugin.settings.openaiApiKey)
					.onChange(async (value) => {
						this.plugin.settings.openaiApiKey = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Index Refresh Rate')
			.setDesc('How often should the embedding index be updated?')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('manual', 'Manual')
					.addOption('always', 'Always')
					.addOption('onNewNote', 'On New Note')
					.setValue(this.plugin.settings.indexRefreshRate)
					.onChange(async (value) => {
						this.plugin.settings.indexRefreshRate = value as 'manual' | 'always' | 'onNewNote';
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Excluded Files and Folders')
			.setDesc('Enter a comma-separated list of files or folders to exclude from the index')
			.addText((text) =>
				text
					.setPlaceholder('path/to/file.md, path/to/folder')
					.setValue(this.plugin.settings.excludedFilesAndFolders.join(', '))
					.onChange(async (value) => {
						this.plugin.settings.excludedFilesAndFolders = value.split(',').map((s) => s.trim());
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Number of Results')
			.setDesc('How many similar notes to display')
			.addSlider((slider) =>
				slider
					.setLimits(1, 100, 1)
					.setValue(this.plugin.settings.numberOfResults)
					.onChange(async (value) => {
						this.plugin.settings.numberOfResults = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Embedding Model')
			.setDesc('Choose the OpenAI embedding model to use')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('text-embedding-ada-002', 'text-embedding-ada-002')
					.addOption('text-embedding-babbage-001', 'text-embedding-babbage-001')
					// ... Add more models as needed
					.setValue(this.plugin.settings.embeddingModel)
					.onChange(async (value) => {
						this.plugin.settings.embeddingModel = value;
						await this.plugin.saveSettings();
					})
			);
	}
}