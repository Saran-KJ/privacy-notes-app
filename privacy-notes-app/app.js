/**
 * Main Application Module - Handles UI interactions and app state
 * Integrates crypto, storage, and UI components
 */

class SecureNotesApp {
    constructor() {
        this.crypto = new CryptoManager();
        this.storage = new StorageManager();
        this.currentNote = null;
        this.notes = [];
        this.filteredNotes = [];
        this.currentFilter = 'all';
        this.selectedTags = [];
        this.searchQuery = '';
        this.isAuthenticated = false;
        this.currentUser = null;
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Initialize storage
            await this.storage.initialize();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Check if this is a new user or returning user
            this.checkUserStatus();
            
            console.log('SecureNotes app initialized');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application');
        }
    }

    /**
     * Check if user has existing vault or needs setup
     */
    checkUserStatus() {
        // Generate or get user ID based on browser fingerprint
        this.currentUser = this.getUserId();
        
        // Check if user has existing vault
        const hasVault = localStorage.getItem(`user_vault_${this.currentUser}`);
        
        if (hasVault) {
            this.showLoginScreen();
        } else {
            this.showSetupScreen();
        }
    }

    /**
     * Generate unique user ID for this browser/device
     */
    getUserId() {
        let userId = localStorage.getItem('user_id');
        if (!userId) {
            // Create unique ID based on browser characteristics
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('Browser fingerprint', 2, 2);
            
            const fingerprint = canvas.toDataURL() + 
                               navigator.userAgent + 
                               navigator.language + 
                               screen.width + screen.height +
                               new Date().getTimezoneOffset();
            
            // Create hash of fingerprint
            userId = btoa(fingerprint).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
            localStorage.setItem('user_id', userId);
        }
        return userId;
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Setup screen
        document.getElementById('create-vault-btn').addEventListener('click', () => this.handleSetup());
        document.getElementById('setup-passphrase').addEventListener('input', () => this.validateSetupForm());
        document.getElementById('confirm-passphrase').addEventListener('input', () => this.validateSetupForm());
        document.getElementById('show-setup').addEventListener('click', (e) => {
            e.preventDefault();
            this.showSetupScreen();
        });

        // Link for users who already have a passphrase (from the setup screen)
        const showLoginEl = document.getElementById('show-login');
        if (showLoginEl) {
            showLoginEl.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLoginScreen();
            });
        }

        // Password toggle buttons
        document.querySelectorAll('.password-toggle').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent any default button behavior
                const targetId = e.currentTarget.dataset.target;
                const input = document.getElementById(targetId);
                const icon = e.currentTarget.querySelector('i');
                
                if (!input) return; // Guard clause if input not found
                
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.className = 'fas fa-eye-slash';
                    e.currentTarget.classList.add('showing');
                    e.currentTarget.setAttribute('title', 'Hide password');
                } else {
                    input.type = 'password';
                    icon.className = 'fas fa-eye';
                    e.currentTarget.classList.remove('showing');
                    e.currentTarget.setAttribute('title', 'Show password');
                }
            });
        });

        // Login screen
        document.getElementById('unlock-btn').addEventListener('click', () => this.handleLogin());
        document.getElementById('passphrase').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });

        // Main app header
        document.getElementById('new-note-btn').addEventListener('click', () => this.createNewNote());
        document.getElementById('lock-btn').addEventListener('click', () => this.lockApp());
        document.getElementById('search-input').addEventListener('input', (e) => this.handleSearch(e.target.value));

        // Welcome screen
        document.getElementById('create-first-note').addEventListener('click', () => this.createNewNote());

        // Mobile sidebar toggle
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const mobileOverlay = document.getElementById('mobile-sidebar-overlay');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', (e) => {
                e.preventDefault();
                document.body.classList.add('sidebar-open');
                if (mobileOverlay) {
                    mobileOverlay.classList.remove('hidden');
                    mobileOverlay.setAttribute('aria-hidden', 'false');
                }
            });
        }

        if (mobileOverlay) {
            mobileOverlay.addEventListener('click', () => {
                document.body.classList.remove('sidebar-open');
                mobileOverlay.classList.add('hidden');
                mobileOverlay.setAttribute('aria-hidden', 'true');
            });
        }

        // Note editor
        document.getElementById('save-note').addEventListener('click', () => this.saveCurrentNote());
        document.getElementById('delete-note').addEventListener('click', () => this.deleteCurrentNote());
        document.getElementById('pin-note').addEventListener('click', () => this.togglePinNote());
        document.getElementById('archive-note').addEventListener('click', () => this.toggleArchiveNote());

        // Auto-save on content change
        document.getElementById('note-title').addEventListener('input', () => this.scheduleAutoSave());
        document.getElementById('note-content').addEventListener('input', () => this.scheduleAutoSave());
        document.getElementById('tags-input').addEventListener('input', () => this.scheduleAutoSave());

        // Filter tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.setFilter(e.target.dataset.filter));
        });

        // Utilities
        const exportBtn = document.getElementById('btn-export');
        const importBtn = document.getElementById('btn-import');
        const clearBtn = document.getElementById('btn-clear');
        const importFile = document.getElementById('import-file');

        if (exportBtn) exportBtn.addEventListener('click', () => this.handleExport());
        if (importBtn) importBtn.addEventListener('click', () => importFile && importFile.click());
        if (clearBtn) clearBtn.addEventListener('click', () => this.handleClearAll());
        if (importFile) importFile.addEventListener('change', (e) => this.handleImportFile(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    /**
     * Handle first-time setup with passphrase creation
     */
    async handleSetup() {
        const passphrase = document.getElementById('setup-passphrase').value;
        const confirmPassphrase = document.getElementById('confirm-passphrase').value;

        if (!passphrase.trim()) {
            this.showError('Please enter a passphrase');
            return;
        }

        if (passphrase !== confirmPassphrase) {
            this.showError('Passphrases do not match');
            return;
        }

        const strength = this.crypto.analyzePasswordStrength(passphrase);
        if (strength.strength === 'weak') {
            this.showError('Please choose a stronger passphrase');
            return;
        }

        this.showLoading('Creating your secure vault...');

        try {
            const success = await this.crypto.createUserVault(passphrase, this.currentUser);

            if (success) {
                this.storage.setUserId(this.currentUser);
                this.isAuthenticated = true;
                await this.loadNotes();
                this.showMainScreen();
                this.hideLoading();

                // Clear form
                document.getElementById('setup-passphrase').value = '';
                document.getElementById('confirm-passphrase').value = '';

                this.showSuccess('Vault created successfully! Your notes are now encrypted.');
            } else {
                this.hideLoading();
                this.showError('Failed to create vault. Please try again.');
            }
        } catch (error) {
            this.hideLoading();
            console.error('Setup failed:', error);
            this.showError('Setup failed. Please try again.');
        }
    }

    /**
     * Validate setup form and update UI
     */
    validateSetupForm() {
        const passphrase = document.getElementById('setup-passphrase').value;
        const confirmPassphrase = document.getElementById('confirm-passphrase').value;
        const createBtn = document.getElementById('create-vault-btn');
        const strengthBar = document.querySelector('.strength-fill');
        const strengthText = document.querySelector('.strength-text');
        
        // Analyze passphrase strength
        if (passphrase) {
            const analysis = this.crypto.analyzePasswordStrength(passphrase);
            
            // Update strength bar
            strengthBar.className = `strength-fill ${analysis.strength}`;
            strengthText.textContent = `Strength: ${analysis.strength.toUpperCase()}`;
            
            if (analysis.feedback.length > 0) {
                strengthText.textContent += ` - ${analysis.feedback[0]}`;
            }
        } else {
            strengthBar.className = 'strength-fill';
            strengthText.textContent = 'Enter a passphrase to see strength';
        }
        
        // Enable create button if conditions are met
        const isValid = passphrase.length >= 8 && 
                       passphrase === confirmPassphrase && 
                       this.crypto.analyzePasswordStrength(passphrase).strength !== 'weak';
        
        createBtn.disabled = !isValid;
    }

    /**
     * Handle login with passphrase
     */
    async handleLogin() {
        const passphrase = document.getElementById('passphrase').value;
        
        if (!passphrase.trim()) {
            this.showError('Please enter a passphrase');
            return;
        }

        this.showLoading('Verifying passphrase...');

        try {
            this.storage.setUserId(this.currentUser);
            const success = await this.crypto.initialize(passphrase, this.currentUser);
            
            if (success) {
                this.isAuthenticated = true;
                await this.loadNotes();
                this.showMainScreen();
                this.hideLoading();
                
                // Clear passphrase from input
                document.getElementById('passphrase').value = '';
            } else {
                this.hideLoading();
                this.showError('Invalid passphrase. Please try again.');
            }
        } catch (error) {
            this.hideLoading();
            console.error('Login failed:', error);
            this.showError('Login failed. Please try again.');
        }
    }

    /**
     * Load and decrypt all notes
     */
    async loadNotes() {
        try {
            this.showLoading('Loading your notes...');
            
            const encryptedNotes = await this.storage.getAllNotes();
            this.notes = [];

            for (const encryptedNote of encryptedNotes) {
                try {
                    const decryptedNote = await this.crypto.decryptNote(encryptedNote);
                    this.notes.push(decryptedNote);
                } catch (error) {
                    console.error('Failed to decrypt note:', encryptedNote.id, error);
                }
            }

            this.applyCurrentFilter();
            this.updateNotesUI();
            this.updateTagsUI();
            
            this.hideLoading();
        } catch (error) {
            this.hideLoading();
            console.error('Failed to load notes:', error);
            this.showError('Failed to load notes');
        }
    }

    /**
     * Create a new note
     */
    createNewNote() {
        const newNote = {
            id: this.storage.generateId(),
            title: '',
            content: '',
            tags: [],
            pinned: false,
            archived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.currentNote = newNote;
        this.showNoteEditor();
        this.populateEditor(newNote);
        
        // Focus on title input
        document.getElementById('note-title').focus();
    }

    /**
     * Save the current note
     */
    async saveCurrentNote() {
        if (!this.currentNote) return;

        try {
            this.showLoading('Saving note...');

            // Get data from editor
            const title = document.getElementById('note-title').value.trim() || 'Untitled';
            const content = document.getElementById('note-content').value;
            const tagsInput = document.getElementById('tags-input').value;
            const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

            // Update note object
            this.currentNote.title = title;
            this.currentNote.content = content;
            this.currentNote.tags = tags;
            this.currentNote.updatedAt = new Date().toISOString();

            // Encrypt and save
            const encryptedNote = await this.crypto.encryptNote(this.currentNote);
            await this.storage.saveNote(encryptedNote);

            // Update local notes array
            const existingIndex = this.notes.findIndex(note => note.id === this.currentNote.id);
            if (existingIndex >= 0) {
                this.notes[existingIndex] = { ...this.currentNote };
            } else {
                this.notes.unshift(this.currentNote);
            }

            this.applyCurrentFilter();
            this.updateNotesUI();
            this.updateTagsUI();
            this.updateNoteTimestamp();
            
            this.hideLoading();
            this.showSuccess('Note saved successfully');
        } catch (error) {
            this.hideLoading();
            console.error('Failed to save note:', error);
            this.showError('Failed to save note');
        }
    }

    /**
     * Delete the current note
     */
    async deleteCurrentNote() {
        if (!this.currentNote) return;

        if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
            return;
        }

        try {
            this.showLoading('Deleting note...');

            await this.storage.deleteNote(this.currentNote.id);
            
            // Remove from local array
            this.notes = this.notes.filter(note => note.id !== this.currentNote.id);
            
            this.applyCurrentFilter();
            this.updateNotesUI();
            this.updateTagsUI();
            
            // Show welcome screen if no notes
            if (this.notes.length === 0) {
                this.showWelcomeScreen();
            } else {
                this.showWelcomeScreen();
            }
            
            this.currentNote = null;
            this.hideLoading();
            this.showSuccess('Note deleted successfully');
        } catch (error) {
            this.hideLoading();
            console.error('Failed to delete note:', error);
            this.showError('Failed to delete note');
        }
    }

    /**
     * Toggle pin status of current note
     */
    async togglePinNote() {
        if (!this.currentNote) return;

        this.currentNote.pinned = !this.currentNote.pinned;
        this.updatePinButton();
        
        // Auto-save the change
        await this.saveCurrentNote();
    }

    /**
     * Toggle archive status of current note
     */
    async toggleArchiveNote() {
        if (!this.currentNote) return;

        this.currentNote.archived = !this.currentNote.archived;
        this.updateArchiveButton();

        // Auto-save the change
        await this.saveCurrentNote();

        // If archived, close editor to avoid editing archived note
        if (this.currentNote.archived) {
            this.showWelcomeScreen();
        }
    }

    /**
     * Handle search functionality
     */
    handleSearch(query) {
        this.searchQuery = query.trim();
        console.log('Search query:', this.searchQuery); // Debug log
        this.applyCurrentFilter();
        this.updateNotesUI();
    }

    /**
     * Set filter for notes
     */
    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update filter tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.filter === filter);
        });

        this.applyCurrentFilter();
        this.updateNotesUI();
    }

    /**
     * Apply current filter and search to notes
     */
    applyCurrentFilter() {
        let filtered = [...this.notes];

        // Archived handling: exclude archived unless viewing archived
        if (this.currentFilter !== 'archived') {
            filtered = filtered.filter(note => !note.archived);
        }

        // Apply filter
        switch (this.currentFilter) {
            case 'pinned':
                filtered = filtered.filter(note => note.pinned);
                break;
            case 'recent':
                filtered = filtered.filter(note => {
                    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                    return new Date(note.updatedAt) > dayAgo;
                });
                break;
            case 'archived':
                filtered = filtered.filter(note => note.archived);
                break;
        }

        // Apply tag filter
        if (this.selectedTags.length > 0) {
            filtered = filtered.filter(note => 
                this.selectedTags.some(tag => note.tags.includes(tag))
            );
        }

        // Apply search
        if (this.searchQuery) {
            filtered = this.storage.searchNotes(this.searchQuery, filtered);
        }

        this.filteredNotes = filtered;
    }

    /**
     * Update notes list UI
     */
    updateNotesUI() {
        const notesList = document.getElementById('notes-list');
        const notesCount = document.getElementById('notes-count');
        
        if (notesCount) {
            notesCount.textContent = this.filteredNotes.length;
        }

        // Handle search results display
        if (this.searchQuery && this.searchQuery.length > 0) {
            this.showSearchResults();
            return;
        }

        // Hide search results when not searching
        const searchResults = document.getElementById('search-results');
        if (searchResults) {
            searchResults.classList.add('hidden');
        }

        if (!notesList) return;

        if (this.filteredNotes.length === 0) {
            notesList.innerHTML = '<div class="no-notes">No notes found</div>';
            // Only show welcome screen during initial load, not during updates
            if (this.notes.length === 0 && !document.getElementById('welcome-screen').classList.contains('hidden')) {
                this.showWelcomeScreen();
            }
            return;
        }

        notesList.innerHTML = this.filteredNotes.map(note => `
            <div class="note-item ${this.currentNote && this.currentNote.id === note.id ? 'active' : ''}" 
                 data-note-id="${note.id}">
                <div class="note-title">
                    ${note.pinned ? '<i class="fas fa-thumbtack pin-icon"></i>' : ''}
                    ${this.escapeHtml(note.title || 'Untitled')}
                </div>
                <div class="note-preview">${this.escapeHtml(note.content.substring(0, 100))}${note.content.length > 100 ? '...' : ''}</div>
                <div class="note-meta">
                    <span>${this.formatDate(note.updatedAt)}</span>
                    <div class="note-tags">
                        ${note.tags.slice(0, 3).map(tag => `<span class="note-tag">${this.escapeHtml(tag)}</span>`).join('')}
                        ${note.tags.length > 3 ? `<span class="note-tag">+${note.tags.length - 3}</span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');

        // Add click listeners to note items
        notesList.querySelectorAll('.note-item').forEach(item => {
            item.addEventListener('click', () => {
                const noteId = item.dataset.noteId;
                this.openNote(noteId);
            });
        });
    }

    /**
     * Update tags UI
     */
    updateTagsUI() {
        const tagsList = document.getElementById('tags-list');
        const allTags = this.storage.getAllTags(this.notes);

        if (allTags.length === 0) {
            tagsList.innerHTML = '<div class="no-tags">No tags yet</div>';
            return;
        }

        tagsList.innerHTML = allTags.map(({ tag, count }) => `
            <span class="tag ${this.selectedTags.includes(tag) ? 'active' : ''}" data-tag="${tag}">
                ${this.escapeHtml(tag)} (${count})
            </span>
        `).join('');

        // Add click listeners to tags
        tagsList.querySelectorAll('.tag').forEach(tagElement => {
            tagElement.addEventListener('click', () => {
                const tag = tagElement.dataset.tag;
                this.toggleTagFilter(tag);
            });
        });
    }

    /**
     * Toggle tag filter
     */
    toggleTagFilter(tag) {
        const index = this.selectedTags.indexOf(tag);
        if (index >= 0) {
            this.selectedTags.splice(index, 1);
        } else {
            this.selectedTags.push(tag);
        }

        this.applyCurrentFilter();
        this.updateNotesUI();
        this.updateTagsUI();
    }

    /**
     * Open a note for editing
     */
    openNote(noteId) {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;

        this.currentNote = note;
        this.showNoteEditor();
        this.populateEditor(note);
        this.updateNotesUI(); // Update to show active state
    }

    /**
     * Populate editor with note data
     */
    populateEditor(note) {
        document.getElementById('note-title').value = note.title || '';
        document.getElementById('note-content').value = note.content || '';
        document.getElementById('tags-input').value = note.tags ? note.tags.join(', ') : '';
        
        this.updatePinButton();
        this.updateArchiveButton();
        this.updateNoteTimestamp();
    }

    /**
     * Update pin button state
     */
    updatePinButton() {
        const pinButton = document.getElementById('pin-note');
        const isPinned = this.currentNote && this.currentNote.pinned;
        
        pinButton.classList.toggle('active', isPinned);
        pinButton.title = isPinned ? 'Unpin Note' : 'Pin Note';
        
        const icon = pinButton.querySelector('i');
        icon.className = isPinned ? 'fas fa-thumbtack' : 'far fa-thumbtack';
    }

    /**
     * Update archive button state
     */
    updateArchiveButton() {
        const archiveButton = document.getElementById('archive-note');
        const isArchived = this.currentNote && this.currentNote.archived;

        archiveButton.classList.toggle('active', isArchived);
        archiveButton.title = isArchived ? 'Unarchive Note' : 'Archive Note';

        const icon = archiveButton.querySelector('i');
        icon.className = isArchived ? 'fas fa-box-open' : 'fas fa-box-archive';
    }

    /**
     * Update note timestamp display
     */
    updateNoteTimestamp() {
        const timestampElement = document.getElementById('note-timestamp');
        if (this.currentNote) {
            timestampElement.textContent = `Last updated: ${this.formatDate(this.currentNote.updatedAt)}`;
        }
    }

    /**
     * Schedule auto-save (debounced)
     */
    scheduleAutoSave() {
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
            if (this.currentNote) {
                this.saveCurrentNote();
            }
        }, 2000); // Auto-save after 2 seconds of inactivity
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(e) {
        if (!this.isAuthenticated) return;

        // Ctrl/Cmd + N: New note
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            this.createNewNote();
        }

        // Ctrl/Cmd + S: Save note
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.saveCurrentNote();
        }

        // Ctrl/Cmd + F: Focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            document.getElementById('search-input').focus();
        }

        // Escape: Close editor
        if (e.key === 'Escape') {
            this.showWelcomeScreen();
        }
    }

    /**
     * Lock the application
     */
    lockApp() {
        this.isAuthenticated = false;
        this.crypto.clear();
        this.notes = [];
        this.filteredNotes = [];
        this.currentNote = null;
        this.searchQuery = '';
        this.selectedTags = [];
        
        // Clear search input
        document.getElementById('search-input').value = '';
        
        this.showLoginScreen();
    }

    /**
     * Show setup screen for new users
     */
    showSetupScreen() {
        document.getElementById('setup-screen').classList.add('active');
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('main-screen').classList.remove('active');
        document.getElementById('setup-passphrase').focus();
    }

    /**
     * Show login screen
     */
    showLoginScreen() {
        document.getElementById('setup-screen').classList.remove('active');
        document.getElementById('login-screen').classList.add('active');
        document.getElementById('main-screen').classList.remove('active');
        document.getElementById('passphrase').focus();
    }

    /**
     * Show main application screen
     */
    showMainScreen() {
        document.getElementById('setup-screen').classList.remove('active');
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('main-screen').classList.add('active');
        
        if (this.notes.length === 0) {
            this.showWelcomeScreen();
        }
    }

    /**
     * Show welcome screen
     */
    showWelcomeScreen() {
        document.getElementById('welcome-screen').classList.remove('hidden');
        document.getElementById('note-editor').classList.add('hidden');
        this.currentNote = null;
        // Update note list without triggering welcome screen again
        const notesList = document.getElementById('notes-list');
        if (notesList) {
            notesList.innerHTML = '<div class="no-notes">No notes found</div>';
        }
    }

    /**
     * Show note editor
     */
    showNoteEditor() {
        document.getElementById('welcome-screen').classList.add('hidden');
        document.getElementById('note-editor').classList.remove('hidden');
    }

    /**
     * Show loading overlay
     */
    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        overlay.querySelector('p').textContent = message;
        overlay.classList.remove('hidden');
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }

    /**
     * Show error message
     */
    showError(message) {
        // Simple console log instead of alert to avoid interrupting user flow
        console.error('Error: ' + message);
        
        // Create a temporary toast notification instead of alert
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            box-shadow: 0 8px 20px rgba(239, 68, 68, 0.3);
            z-index: 10000;
            font-weight: 600;
            max-width: 300px;
            animation: slideIn 0.3s ease-out;
        `;
        toast.textContent = message;
        
        // Add slide-in animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(toast);
        
        // Auto-remove after 4 seconds
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
                if (style.parentNode) {
                    style.parentNode.removeChild(style);
                }
            }, 300);
        }, 4000);
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        console.log('Success: ' + message);
        
        // Create a success toast notification
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            box-shadow: 0 8px 20px rgba(16, 185, 129, 0.3);
            z-index: 10000;
            font-weight: 600;
            max-width: 300px;
            animation: slideIn 0.3s ease-out;
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    /**
     * Export encrypted data to a file
     */
    async handleExport() {
        try {
            const data = await this.storage.exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const date = new Date().toISOString().replace(/[:.]/g, '-');
            a.download = `securenotes-backup-${date}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            this.showSuccess('Backup exported');
        } catch (e) {
            this.showError('Failed to export backup');
        }
    }

    /**
     * Handle import button file selection
     */
    async handleImportFile(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        try {
            this.showLoading('Importing data...');
            const text = await file.text();
            const data = JSON.parse(text);
            const success = await this.storage.importData(data);
            if (success) {
                await this.loadNotes();
                this.showSuccess('Import completed');
            } else {
                this.showError('Import failed');
            }
        } catch (e) {
            console.error(e);
            this.showError('Invalid import file');
        } finally {
            this.hideLoading();
            // reset input
            event.target.value = '';
        }
    }

    /**
     * Clear all data from storage
     */
    async handleClearAll() {
        if (!confirm('Clear all notes and settings? This cannot be undone.')) return;
        try {
            this.showLoading('Clearing data...');
            await this.storage.clearAllData();
            this.notes = [];
            this.filteredNotes = [];
            this.currentNote = null;
            this.updateNotesUI();
            this.updateTagsUI();
            this.showWelcomeScreen();
            this.showSuccess('All data cleared');
        } catch (e) {
            this.showError('Failed to clear data');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    }

    /**
     * Show search results in center area
     */
    showSearchResults() {
        // Hide other screens
        document.getElementById('welcome-screen').classList.add('hidden');
        document.getElementById('note-editor').classList.add('hidden');
        
        // Show search results
        const searchResults = document.getElementById('search-results');
        searchResults.classList.remove('hidden');
        
        // Update search results content
        const searchTitle = document.getElementById('search-results-title');
        const searchCount = document.getElementById('search-results-count');
        const searchList = document.getElementById('search-results-list');
        
        searchTitle.textContent = `Search Results for "${this.searchQuery}"`;
        searchCount.textContent = `${this.filteredNotes.length} notes found`;
        
        if (this.filteredNotes.length === 0) {
            searchList.innerHTML = `
                <div style="text-align: center; color: var(--text-secondary); padding: 2rem;">
                    <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>No notes found for "${this.escapeHtml(this.searchQuery)}"</p>
                </div>
            `;
            return;
        }
        
        searchList.innerHTML = this.filteredNotes.map(note => `
            <div class="search-result-card" data-note-id="${note.id}">
                <div class="search-result-title">
                    ${note.pinned ? '<i class="fas fa-thumbtack pin-icon"></i>' : ''}
                    ${this.escapeHtml(note.title || 'Untitled')}
                </div>
                <div class="search-result-content">
                    ${this.escapeHtml(note.content)}
                </div>
                <div class="search-result-meta">
                    <span>${this.formatDate(note.updatedAt)}</span>
                    <div class="search-result-tags">
                        ${note.tags.slice(0, 3).map(tag => 
                            `<span class="search-result-tag">${this.escapeHtml(tag)}</span>`
                        ).join('')}
                        ${note.tags.length > 3 ? `<span class="search-result-tag">+${note.tags.length - 3}</span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add click listeners to search result cards
        searchList.querySelectorAll('.search-result-card').forEach(card => {
            card.addEventListener('click', () => {
                const noteId = card.dataset.noteId;
                this.openNote(noteId);
            });
        });
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SecureNotesApp();
});

// Mobile viewport fix: set --vh to 1% of the window innerHeight to work around mobile browser chrome resizing
function setVhCssVariable() {
    try {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    } catch (e) {
        // ignore
    }
}

setVhCssVariable();
window.addEventListener('resize', () => setVhCssVariable());
window.addEventListener('orientationchange', () => setVhCssVariable());

// Ensure textarea scrolls into view when focused (helps on mobile when keyboard opens)
function addEditorFocusScroll() {
    const content = document.getElementById('note-content');
    if (!content) return;

    content.addEventListener('focus', () => {
        // small timeout to allow keyboard to open
        setTimeout(() => {
            content.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    });
}

// Try to add handler once DOM is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    addEditorFocusScroll();
} else {
    document.addEventListener('DOMContentLoaded', addEditorFocusScroll);
}
