
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
    
    // Use npm for electron dependencies (more reliable than bun for native deps)
    await runCommand('npm', ['install'], electronDir);
    
    // Step 3: Build the desktop app
    console.log('🖥️ Building desktop application...');
    await runCommand('npm', ['run', 'build'], electronDir);
    
    console.log('✅ Desktop application built successfully!');
    console.log('📂 Output directory: dist-electron/');
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
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
