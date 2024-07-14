import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, ItemView } from 'obsidian';


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
	// ... (Add other variables like embedding cache here later)

	async onload() {
		await this.loadSettings();

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