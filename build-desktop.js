
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
    
    console.log('✅ Desktop application built successfully!');
    console.log('📂 Output directory: dist-electron/');
    console.log('💡 Tip: Use the portable version if you encounter installation issues');
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    console.log('\n🔍 Troubleshooting tips:');
    console.log('- Make sure you have Visual Studio Build Tools installed on Windows');
    console.log('- Try running as administrator');
    console.log('- Check if Python 3.x is installed and accessible');
    process.exit(1);
  }
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
