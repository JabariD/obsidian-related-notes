import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, ItemView, TFile, TAbstractFile } from 'obsidian';
import * as path from 'path';
import { NoteEmbedder } from 'embeddings/note_embedder';


// Interface for embedding data
interface EmbeddingData {
	[filePath: string]: number[];
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
	embedder:  NoteEmbedder;
	// ... (Add other variables like embedding cache here later)

	async onload() {
		await this.loadSettings();
		this.embedder = new NoteEmbedder(this.settings.openaiApiKey);

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

		this.addCommand({
			id: 'new-embedding-manager',
			name: 'Add Embedding For ActiveNote',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				if (this.settings.openaiApiKey === '') {
					new Notice('Please enter your OpenAI API key in the plugin settings first.');
					return;
				}

				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					const content: string = await this.app.vault.read(activeFile);
					await this.embedder.addNote({ title: activeFile.name, content: content });
				} else {
					new Notice('No active file found.');
				}
			},
		});

		this.addCommand({
			id: 'similiar-notes',
			name: 'Any Similiar Notes',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					const content: string = await this.app.vault.read(activeFile);

					const searchResults = await this.embedder.searchNotes(content, /*k=*/50);

					searchResults.forEach(([note, score]) => {
						console.log(`Title: ${note.title}`);
						console.log(`Content: ${note.content}`);
						console.log(`Similarity Score: ${score}`);
						console.log('---');
					});
				} else {
					new Notice('No active file found.');
				}
			},
		});

		// Add test commands
        this.addCommand({
            id: 'test-add-note',
            name: 'Test: Add Note',
            callback: async () => {
                try {
                    const note = { title: 'Test Note', content: 'This is a test note content.' };
                    await this.embedder.addNote(note);
                    console.log('Test: Add Note - Success');
                    new Notice('Test: Add Note - Success');
                } catch (error) {
                    console.error('Test: Add Note - Failed', error);
                    new Notice('Test: Add Note - Failed. Check console for details.');
                }
            }
        });

        this.addCommand({
            id: 'test-search-notes',
            name: 'Test: Search Notes',
            callback: async () => {
                try {
                    const query = 'test';
                    const results = await this.embedder.searchNotes(query, 5);
                    console.log('Test: Search Notes - Success', results);
                    new Notice(`Test: Search Notes - Success. Found ${results.length} results.`);
                } catch (error) {
                    console.error('Test: Search Notes - Failed', error);
                    new Notice('Test: Search Notes - Failed. Check console for details.');
                }
            }
        });

        this.addCommand({
            id: 'test-save-to-file',
            name: 'Test: Save to File',
            callback: async () => {
                try {
                    const filePath = path.join(this.app.vault.configDir, 'test-vector-store.json');
                    await this.embedder.saveToFile(filePath);
                    console.log('Test: Save to File - Success', filePath);
                    new Notice(`Test: Save to File - Success. Saved to ${filePath}`);
                } catch (error) {
                    console.error('Test: Save to File - Failed', error);
                    new Notice('Test: Save to File - Failed. Check console for details.');
                }
            }
        });

        this.addCommand({
            id: 'test-load-from-file',
            name: 'Test: Load from File',
            callback: async () => {
                try {
                    const filePath = path.join(this.app.vault.configDir, 'test-vector-store.json');
                    await this.embedder.loadFromFile(filePath);
                    console.log('Test: Load from File - Success');
                    new Notice('Test: Load from File - Success');
                } catch (error) {
                    console.error('Test: Load from File - Failed', error);
                    new Notice('Test: Load from File - Failed. Check console for details.');
                }
            }
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