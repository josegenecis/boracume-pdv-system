
#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function buildDesktop() {
  console.log('🚀 Building Bora Cume Hub Desktop...');
  
  try {
    // Step 1: Build the React app
    console.log('📦 Building React application...');
    await runCommand('npm', ['run', 'build'], process.cwd());
    
    // Step 2: Install electron dependencies
    console.log('⚡ Installing Electron dependencies...');
    const electronDir = path.join(process.cwd(), 'electron');
    
    // Check if electron directory exists
    if (!fs.existsSync(electronDir)) {
      throw new Error('Electron directory not found');
    }
    
    // Clean install for better compatibility
    console.log('🧹 Cleaning electron dependencies...');
    const nodeModulesPath = path.join(electronDir, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      await runCommand('rm', ['-rf', 'node_modules'], electronDir);
    }
    
    // Install dependencies
    await runCommand('npm', ['install'], electronDir);
    
    // Step 3: Rebuild native dependencies for electron
    console.log('🔧 Rebuilding native dependencies...');
    await runCommand('npm', ['run', 'rebuild'], electronDir);
    
    // Step 4: Build the desktop app
    console.log('🖥️ Building desktop application...');
    await runCommand('npm', ['run', 'build'], electronDir);
    
    // Step 5: Create public dist folder for downloads
    console.log('📁 Creating public download directory...');
    const publicDistDir = path.join(process.cwd(), 'public', 'electron-dist');
    
    if (!fs.existsSync(publicDistDir)) {
      fs.mkdirSync(publicDistDir, { recursive: true });
    }
    
    // Copy built files to public directory
    const builtFilesDir = path.join(process.cwd(), 'dist-electron');
    if (fs.existsSync(builtFilesDir)) {
      console.log('📋 Copying built files to public directory...');
      await copyDirectory(builtFilesDir, publicDistDir);
    }
    
    console.log('✅ Desktop application built successfully!');
    console.log('📂 Output directory: dist-electron/');
    console.log('🌐 Public downloads: public/electron-dist/');
    console.log('💡 Tip: Use the portable version if you encounter installation issues');
    
    // List built files
    if (fs.existsSync(builtFilesDir)) {
      const files = fs.readdirSync(builtFilesDir);
      console.log('\n📋 Built files:');
      files.forEach(file => console.log(`  - ${file}`));
    }
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    console.log('\n🔍 Troubleshooting tips:');
    console.log('- Make sure you have Visual Studio Build Tools installed on Windows');
    console.log('- Try running as administrator');
    console.log('- Check if Python 3.x is installed and accessible');
    console.log('- Verify Node.js version is 18+');
    process.exit(1);
  }
}

function copyDirectory(src, dest) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'xcopy' : 'cp';
    const args = isWindows ? [src, dest, '/E', '/I', '/Y'] : ['-r', src + '/.', dest];
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Copy failed with exit code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

buildDesktop();
