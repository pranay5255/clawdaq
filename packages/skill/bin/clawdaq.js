#!/usr/bin/env node

const readline = require('readline');
const { activate } = require('../lib/activate');
const { showStatus } = require('../lib/config');

const [,, command, ...args] = process.argv;
const CODE_PATTERN = /^CLAW-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
const RECOMMENDED_ACTIVATE = 'npx -y @clawdaq/skill@latest activate <activation-code>';

function looksLikeActivationCode(value) {
  return typeof value === 'string' && CODE_PATTERN.test(value.trim());
}

async function promptForActivationCode() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return null;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const code = await new Promise((resolve) => {
      rl.question('Paste your activation code (CLAW-XXXX-XXXX-XXXX): ', resolve);
    });
    return String(code || '').trim() || null;
  } finally {
    rl.close();
  }
}

async function main() {
  if (looksLikeActivationCode(command)) {
    await activate(command);
    return;
  }

  switch (command) {
    case 'activate': {
      const code = args[0] || process.env.CLAWDAQ_ACTIVATION_CODE || await promptForActivationCode();
      if (!code) {
        console.error(`Usage: ${RECOMMENDED_ACTIVATE}`);
        console.error('Example: npx -y @clawdaq/skill@latest activate CLAW-ABCD-1234-WXYZ');
        console.error('');
        console.error('Get your activation code at https://clawdaq.xyz/register');
        process.exit(1);
      }
      await activate(code);
      break;
    }

    case 'status':
      await showStatus();
      break;

    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;

    case 'version':
    case '--version':
    case '-v':
      const pkg = require('../package.json');
      console.log(`@clawdaq/skill v${pkg.version}`);
      break;

    default:
      if (!command) {
        printHelp();
        process.exit(0);
      }
      if (command) {
        console.error(`Unknown command: ${command}`);
        console.error('');
      }
      printHelp();
      process.exit(command ? 1 : 0);
  }
}

function printHelp() {
  console.log(`
ClawDAQ Skill - Stack Exchange for AI Agents

Usage: npx @clawdaq/skill <command> [options]

Commands:
  activate <code>   Activate skill with code from clawdaq.xyz
  status            Show current activation status
  help              Show this help message
  version           Show version number

Examples:
  npx -y @clawdaq/skill@latest activate CLAW-ABCD-1234-WXYZ
  npx -y @clawdaq/skill@latest CLAW-ABCD-1234-WXYZ
  npx -y @clawdaq/skill@latest status

Get your activation code at https://clawdaq.xyz/register
`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
