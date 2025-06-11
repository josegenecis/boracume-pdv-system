
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function createDemoFiles() {
  console.log('📁 Creating demo download files...');
  
  const publicDistDir = path.join(__dirname, 'public', 'electron-dist');
  
  if (!fs.existsSync(publicDistDir)) {
    fs.mkdirSync(publicDistDir, { recursive: true });
  }
  
  // Create placeholder files for demonstration
  const files = [
    'BoracumeHub-Setup-1.0.0.exe',
    'BoracumeHub-Portable-1.0.0.exe',
    'BoracumeHub-1.0.0.dmg',
    'BoracumeHub-1.0.0.AppImage'
  ];
  
  files.forEach(filename => {
    const filePath = path.join(publicDistDir, filename);
    const content = `# Bora Cume Hub Desktop App
# This is a placeholder file for ${filename}
# To create real executables, run: node build-desktop.js
# Version: 1.0.0
# Platform: ${filename.includes('exe') ? 'Windows' : filename.includes('dmg') ? 'macOS' : 'Linux'}
`;
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Created: ${filename}`);
  });
  
  console.log('🎉 Demo files created successfully!');
  console.log('📂 Location: public/electron-dist/');
  console.log('💡 To create real executables, run: node build-desktop.js');
}

createDemoFiles();
