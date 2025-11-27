/**
 * Test fixture: Create an example React/TypeScript project structure
 */

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { LogicStampIndex, LogicStampBundle } from '../../src/types/schemas.js';
import { createMockContract, createMockBundle } from '../helpers/test-utils.js';

/**
 * Create a realistic example React project structure
 */
export async function createExampleProject(basePath: string): Promise<void> {
  // Create directory structure
  const dirs = [
    'src',
    'src/components',
    'src/components/ui',
    'src/hooks',
    'src/utils',
    'src/features',
    'src/features/auth',
    'src/features/dashboard',
  ];

  for (const dir of dirs) {
    await mkdir(join(basePath, dir), { recursive: true });
  }

  // Create package.json
  const packageJson = {
    name: 'example-react-app',
    version: '1.0.0',
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0',
    },
    devDependencies: {
      '@types/react': '^18.2.0',
      typescript: '^5.0.0',
    },
  };

  await writeFile(
    join(basePath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Create tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      lib: ['ES2020', 'DOM'],
      jsx: 'react-jsx',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
    },
    include: ['src'],
  };

  await writeFile(
    join(basePath, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2)
  );

  // Create source files
  await createSourceFiles(basePath);
}

async function createSourceFiles(basePath: string): Promise<void> {
  // Button component
  const buttonCode = `import React from 'react';

interface ButtonProps {
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export function Button({ label, onClick, variant = 'primary', disabled = false }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={\`btn btn-\${variant}\`}
    >
      {label}
    </button>
  );
}`;

  await writeFile(join(basePath, 'src/components/Button.tsx'), buttonCode);

  // Input component
  const inputCode = `import React, { useState } from 'react';

interface InputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'email';
}

export function Input({ value: initialValue = '', onChange, placeholder, type = 'text' }: InputProps) {
  const [value, setValue] = useState(initialValue);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    onChange?.(e.target.value);
  };

  return <input type={type} value={value} onChange={handleChange} placeholder={placeholder} />;
}`;

  await writeFile(join(basePath, 'src/components/Input.tsx'), inputCode);

  // Card component (UI)
  const cardCode = `import React from 'react';

interface CardProps {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Card({ title, children, footer }: CardProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>{title}</h3>
      </div>
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}`;

  await writeFile(join(basePath, 'src/components/ui/Card.tsx'), cardCode);

  // Custom hook
  const useCounterCode = `import { useState, useCallback } from 'react';

export function useCounter(initialValue: number = 0) {
  const [count, setCount] = useState(initialValue);

  const increment = useCallback(() => {
    setCount(c => c + 1);
  }, []);

  const decrement = useCallback(() => {
    setCount(c => c - 1);
  }, []);

  const reset = useCallback(() => {
    setCount(initialValue);
  }, [initialValue]);

  return { count, increment, decrement, reset };
}`;

  await writeFile(join(basePath, 'src/hooks/useCounter.ts'), useCounterCode);

  // Utility function
  const formatDateCode = `export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function parseDate(dateString: string): Date {
  return new Date(dateString);
}`;

  await writeFile(join(basePath, 'src/utils/date.ts'), formatDateCode);

  // Login form (feature)
  const loginFormCode = `import React, { useState } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';

interface LoginFormProps {
  onSubmit: (username: string, password: string) => void;
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(username, password);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input
        placeholder="Username"
        value={username}
        onChange={setUsername}
      />
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={setPassword}
      />
      <Button label="Login" onClick={handleSubmit} />
    </form>
  );
}`;

  await writeFile(
    join(basePath, 'src/features/auth/LoginForm.tsx'),
    loginFormCode
  );

  // Dashboard widget
  const dashboardCode = `import React from 'react';
import { Card } from '../../components/ui/Card';

interface DashboardWidgetProps {
  title: string;
  value: number | string;
  trend?: 'up' | 'down';
}

export function DashboardWidget({ title, value, trend }: DashboardWidgetProps) {
  return (
    <Card title={title}>
      <div className="widget-value">{value}</div>
      {trend && <div className={\`trend-\${trend}\`}>Trend: {trend}</div>}
    </Card>
  );
}`;

  await writeFile(
    join(basePath, 'src/features/dashboard/DashboardWidget.tsx'),
    dashboardCode
  );
}

/**
 * Create LogicStamp context files for the example project
 */
export async function createExampleContextFiles(basePath: string): Promise<void> {
  // Create main index
  const index: LogicStampIndex = {
    type: 'LogicStampIndex',
    schemaVersion: '1.0.0',
    projectRoot: '.',
    projectRootAbs: basePath,
    summary: {
      totalComponents: 7,
      totalBundles: 7,
      totalFolders: 5,
      totalTokenEstimate: 15000,
      tokenEstimates: {
        gpt4oMini: 7500,
        gpt4oMiniFullCode: 15000,
        claude: 6000,
        claudeFullCode: 12000,
      },
      missingDependencies: [],
    },
    folders: [
      {
        path: 'src/components',
        bundles: 2,
        components: ['Button', 'Input'],
        tokenEstimate: 4000,
      },
      {
        path: 'src/components/ui',
        bundles: 1,
        components: ['Card'],
        tokenEstimate: 2000,
      },
      {
        path: 'src/hooks',
        bundles: 1,
        components: ['useCounter'],
        tokenEstimate: 1500,
      },
      {
        path: 'src/utils',
        bundles: 1,
        components: ['date'],
        tokenEstimate: 1000,
      },
      {
        path: 'src/features/auth',
        bundles: 1,
        components: ['LoginForm'],
        tokenEstimate: 3000,
      },
      {
        path: 'src/features/dashboard',
        bundles: 1,
        components: ['DashboardWidget'],
        tokenEstimate: 2500,
      },
    ],
  };

  await writeFile(
    join(basePath, 'context_main.json'),
    JSON.stringify(index, null, 2)
  );

  // Create bundle files for each folder
  await createComponentBundles(basePath);
}

async function createComponentBundles(basePath: string): Promise<void> {
  // src/components bundles
  const componentBundles: LogicStampBundle[] = [
    createMockBundle('Button', { position: '1/2', includeCode: true }),
    createMockBundle('Input', { position: '2/2', includeCode: true }),
  ];
  componentBundles[0].graph.nodes[0].contract.logicSignature.props = {
    label: { type: 'string', optional: false },
    onClick: { type: '() => void', optional: true },
    variant: { type: "'primary' | 'secondary'", optional: true },
    disabled: { type: 'boolean', optional: true },
  };
  componentBundles[1].graph.nodes[0].contract.logicSignature.props = {
    value: { type: 'string', optional: true },
    onChange: { type: '(value: string) => void', optional: true },
    placeholder: { type: 'string', optional: true },
    type: { type: "'text' | 'password' | 'email'", optional: true },
  };

  await mkdir(join(basePath, 'src/components'), { recursive: true });
  await writeFile(
    join(basePath, 'src/components/context.json'),
    JSON.stringify(componentBundles, null, 2)
  );

  // src/components/ui bundles
  const uiBundles: LogicStampBundle[] = [
    createMockBundle('Card', { position: '1/1', includeCode: true }),
  ];
  uiBundles[0].graph.nodes[0].contract.logicSignature.props = {
    title: { type: 'string', optional: false },
    children: { type: 'React.ReactNode', optional: false },
    footer: { type: 'React.ReactNode', optional: true },
  };

  await mkdir(join(basePath, 'src/components/ui'), { recursive: true });
  await writeFile(
    join(basePath, 'src/components/ui/context.json'),
    JSON.stringify(uiBundles, null, 2)
  );

  // src/hooks bundles
  const hookBundles: LogicStampBundle[] = [
    createMockBundle('useCounter', { position: '1/1' }),
  ];
  hookBundles[0].graph.nodes[0].contract.kind = 'ts:module';

  await mkdir(join(basePath, 'src/hooks'), { recursive: true });
  await writeFile(
    join(basePath, 'src/hooks/context.json'),
    JSON.stringify(hookBundles, null, 2)
  );

  // src/utils bundles
  const utilBundles: LogicStampBundle[] = [
    createMockBundle('date', { position: '1/1' }),
  ];
  utilBundles[0].graph.nodes[0].contract.kind = 'ts:module';
  utilBundles[0].graph.nodes[0].contract.exports = {
    named: ['formatDate', 'parseDate'],
  };

  await mkdir(join(basePath, 'src/utils'), { recursive: true });
  await writeFile(
    join(basePath, 'src/utils/context.json'),
    JSON.stringify(utilBundles, null, 2)
  );

  // src/features/auth bundles
  const authBundles: LogicStampBundle[] = [
    createMockBundle('LoginForm', { position: '1/1', includeCode: true }),
  ];
  authBundles[0].graph.nodes[0].contract.logicSignature.props = {
    onSubmit: {
      type: '(username: string, password: string) => void',
      optional: false,
    },
  };

  await mkdir(join(basePath, 'src/features/auth'), { recursive: true });
  await writeFile(
    join(basePath, 'src/features/auth/context.json'),
    JSON.stringify(authBundles, null, 2)
  );

  // src/features/dashboard bundles
  const dashboardBundles: LogicStampBundle[] = [
    createMockBundle('DashboardWidget', { position: '1/1', includeCode: true }),
  ];
  dashboardBundles[0].graph.nodes[0].contract.logicSignature.props = {
    title: { type: 'string', optional: false },
    value: { type: 'number | string', optional: false },
    trend: { type: "'up' | 'down'", optional: true },
  };

  await mkdir(join(basePath, 'src/features/dashboard'), { recursive: true });
  await writeFile(
    join(basePath, 'src/features/dashboard/context.json'),
    JSON.stringify(dashboardBundles, null, 2)
  );
}

/**
 * Create a minimal test project
 */
export async function createMinimalProject(basePath: string): Promise<void> {
  await mkdir(join(basePath, 'src'), { recursive: true });

  const simpleComponent = `export function Hello() {
  return <div>Hello World</div>;
}`;

  await writeFile(join(basePath, 'src/Hello.tsx'), simpleComponent);

  const index: LogicStampIndex = {
    type: 'LogicStampIndex',
    schemaVersion: '1.0.0',
    projectRoot: '.',
    projectRootAbs: basePath,
    summary: {
      totalComponents: 1,
      totalBundles: 1,
      totalFolders: 1,
      totalTokenEstimate: 500,
      tokenEstimates: {
        gpt4oMini: 250,
        gpt4oMiniFullCode: 500,
        claude: 200,
        claudeFullCode: 400,
      },
      missingDependencies: [],
    },
    folders: [
      {
        path: 'src',
        bundles: 1,
        components: ['Hello'],
        tokenEstimate: 500,
      },
    ],
  };

  await writeFile(
    join(basePath, 'context_main.json'),
    JSON.stringify(index, null, 2)
  );

  const bundles: LogicStampBundle[] = [
    createMockBundle('Hello', { position: '1/1', includeCode: true }),
  ];

  await writeFile(
    join(basePath, 'src/context.json'),
    JSON.stringify(bundles, null, 2)
  );
}
