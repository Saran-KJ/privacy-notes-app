# SecureNotes - Privacy-Focused Notes App with Encryption

A modern, privacy-first notes application that uses client-side AES encryption to keep your data secure. All notes are encrypted locally and never leave your device unencrypted.

![SecureNotes Demo](https://img.shields.io/badge/Status-Production%20Ready-green) ![Security](https://img.shields.io/badge/Security-AES%20256-blue) ![Offline](https://img.shields.io/badge/Offline-First-orange)

## 🔒 Security Features

- **Client-Side Encryption**: All notes are encrypted using AES-256-GCM before storage
- **Zero-Knowledge Architecture**: Your passphrase never leaves your device
- **Offline-First**: Works completely offline using IndexedDB
- **PBKDF2 Key Derivation**: 100,000 iterations with SHA-256 for secure key generation
- **Secure Random IV**: Each note uses a unique initialization vector
- **Memory Protection**: Encryption keys are cleared from memory when locked

## ✨ Features

### Core Functionality
- 📝 **Rich Note Taking**: Create, edit, and organize encrypted notes
- 🔍 **Full-Text Search**: Search through decrypted note content
- 🏷️ **Tag System**: Organize notes with customizable tags
- 📌 **Pin Important Notes**: Keep important notes at the top
- 💾 **Auto-Save**: Automatic saving with 2-second debounce
- ⌨️ **Keyboard Shortcuts**: Efficient navigation and editing

### Privacy & Security
- 🔐 **Passphrase Protection**: Single passphrase unlocks all notes
- 🛡️ **Local Storage Only**: No cloud sync, no external dependencies
- 🔒 **Session Locking**: Manually lock the app to protect data
- 🧪 **Key Validation**: Automatic verification of passphrase correctness

### User Experience
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🌙 **Modern UI**: Clean, intuitive interface with smooth animations
- ⚡ **Fast Performance**: Optimized for speed and efficiency
- 🔄 **Filter & Sort**: Multiple ways to organize and find notes

## 🚀 Quick Start

1. **Clone or Download** the repository
2. **Open** `index.html` in a modern web browser
3. **Enter a passphrase** to create your secure vault
4. **Start writing** encrypted notes!

```bash
# Clone the repository
git clone https://github.com/Saran-KJ/privacy-notes-app.git

# Navigate to the directory
cd secure-notes-app

# Open in browser (or use a local server)
open index.html
```

## 🔧 Technical Architecture

### Encryption Implementation

```javascript
// AES-256-GCM encryption with PBKDF2 key derivation
const key = await crypto.subtle.deriveKey({
    name: 'PBKDF2',
    salt: randomSalt,
    iterations: 100000,
    hash: 'SHA-256'
}, passphraseKey, {
    name: 'AES-GCM',
    length: 256
}, false, ['encrypt', 'decrypt']);
```

### Storage Architecture

- **IndexedDB**: Primary storage for encrypted notes
- **localStorage**: App configuration and salt storage
- **Memory**: Temporary decrypted data (cleared on lock)

### Security Model

```
User Passphrase → PBKDF2 (100k iterations) → AES-256 Key
                                                ↓
Plain Text Note → AES-GCM Encryption → Encrypted Note → IndexedDB
```

## 🛡️ Security Considerations

### What We Protect Against
- ✅ **Data at Rest**: All notes encrypted in browser storage
- ✅ **Memory Dumps**: Keys cleared when app is locked
- ✅ **Weak Passwords**: PBKDF2 with high iteration count
- ✅ **Replay Attacks**: Unique IV for each encryption operation

### What We Don't Protect Against
- ❌ **Browser Vulnerabilities**: Relies on browser security
- ❌ **Malware**: Cannot protect against compromised systems
- ❌ **Physical Access**: Device access could compromise data
- ❌ **Forgotten Passphrases**: No recovery mechanism by design

### Best Practices for Users

1. **Use a Strong Passphrase**: Minimum 12 characters with mixed case, numbers, and symbols
2. **Regular Backups**: Export your encrypted data periodically
3. **Secure Environment**: Use the app on trusted devices only
4. **Lock When Away**: Always lock the app when stepping away
5. **HTTPS Only**: Use over HTTPS in production environments

## 📋 API Reference

### CryptoManager Class

```javascript
const crypto = new CryptoManager();

// Initialize with passphrase
await crypto.initialize(passphrase);

// Encrypt data
const encrypted = await crypto.encrypt(plaintext);

// Decrypt data
const plaintext = await crypto.decrypt(encrypted);

// Encrypt note object
const encryptedNote = await crypto.encryptNote(note);

// Decrypt note object
const note = await crypto.decryptNote(encryptedNote);
```

### StorageManager Class

```javascript
const storage = new StorageManager();

// Initialize database
await storage.initialize();

// Save note
await storage.saveNote(note);

// Get all notes
const notes = await storage.getAllNotes();

// Search notes
const results = storage.searchNotes(query, notes);
```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + N` | Create new note |
| `Ctrl/Cmd + S` | Save current note |
| `Ctrl/Cmd + F` | Focus search |
| `Escape` | Close editor |

## 🔄 Data Import/Export

### Export Data
```javascript
const backupData = await storage.exportData();
const blob = new Blob([JSON.stringify(backupData)], {type: 'application/json'});
// Save blob as file
```

### Import Data
```javascript
const success = await storage.importData(backupData);
```

## 🌐 Browser Compatibility

- ✅ **Chrome 60+**: Full support
- ✅ **Firefox 57+**: Full support  
- ✅ **Safari 11+**: Full support
- ✅ **Edge 79+**: Full support
- ❌ **Internet Explorer**: Not supported

**Requirements:**
- Web Crypto API support
- IndexedDB support
- ES6+ JavaScript support

## 🔒 Security Audit Checklist

- [x] **Encryption Algorithm**: AES-256-GCM (NIST approved)
- [x] **Key Derivation**: PBKDF2 with 100,000 iterations
- [x] **Random Number Generation**: Crypto.getRandomValues()
- [x] **IV Uniqueness**: New IV for each encryption
- [x] **Key Storage**: Keys never stored persistently
- [x] **Input Validation**: All user inputs sanitized
- [x] **XSS Prevention**: HTML escaping implemented
- [x] **Memory Management**: Sensitive data cleared on lock

## 🚧 Future Enhancements

### Planned Features
- [ ] **Backup to File**: Export/import encrypted backups
- [ ] **Note Sharing**: Secure sharing with temporary links
- [ ] **Rich Text Editor**: Markdown support and formatting
- [ ] **File Attachments**: Encrypted file storage
- [ ] **Multiple Vaults**: Separate encrypted containers
- [ ] **Mobile App**: React Native or Flutter version

### Security Enhancements
- [ ] **Hardware Security**: WebAuthn integration
- [ ] **Key Stretching**: Argon2 implementation
- [ ] **Secure Deletion**: Overwrite deleted data
- [ ] **Audit Logging**: Track access patterns
- [ ] **Two-Factor Auth**: Additional security layer

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow existing code style and patterns
- Add tests for new security features
- Update documentation for API changes
- Consider security implications of all changes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This software is provided "as is" without warranty. While we've implemented industry-standard encryption practices, no software is 100% secure. Users should:

- Understand the security model and limitations
- Use strong, unique passphrases
- Keep regular backups of important data
- Use the software at their own risk

## 🙏 Acknowledgments

- **Web Crypto API** for providing secure cryptographic primitives
- **IndexedDB** for reliable offline storage
- **Font Awesome** for beautiful icons
- **Modern CSS** techniques for responsive design

## 📞 Support

- 📧 **Email**: support@securenotes.app
- 🐛 **Issues**: [GitHub Issues](https://github.com/yourusername/secure-notes-app/issues)
- 📖 **Documentation**: [Wiki](https://github.com/yourusername/secure-notes-app/wiki)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/yourusername/secure-notes-app/discussions)

---

**Built with ❤️ for privacy and security**

*Remember: Your privacy is not a feature, it's a fundamental right.*
