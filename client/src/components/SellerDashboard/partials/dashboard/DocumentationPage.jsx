import React from "react";

export default function Documentation() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-8 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="bg-violet-100 p-3 rounded-lg">
            <svg
              className="w-6 h-6 text-violet-600"
              fill="currentColor"
              viewBox="0 0 16 16"
            >
              <path d="M9 7.5a1 1 0 1 0-2 0v4a1 1 0 1 0 2 0v-4ZM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
              <path
                fillRule="evenodd"
                d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16Zm6-8A6 6 0 1 1 2 8a6 6 0 0 1 12 0Z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold">DropdownHelp</h1>
            <p className="text-gray-500">A help resources dropdown component</p>
          </div>
        </div>
      </header>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Overview</h2>
            <p className="mb-4">
              The DropdownHelp component provides users with easy access to
              documentation and support resources through an accessible dropdown
              interface that can be placed in headers, navigation bars, or
              anywhere help is needed.
            </p>
            <div className="flex justify-center p-8 bg-gray-50 dark:bg-gray-800/60 border dark:border-gray-700 rounded-lg">
              <div className="w-64 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 text-left">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Need help?</div>
                <div className="space-y-1 text-sm">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium flex items-center justify-between">
                    <span>Documentation</span>
                    <span className="text-xs bg-amber-500/20 px-1.5 py-0.5 rounded">v1.2</span>
                  </div>
                  <div className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300">
                    Support Forum
                  </div>
                  <div className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300">
                    Contact Admin
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Usage</h2>
            <div className="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-auto">
              <pre>
                <code>
                  {`import React from 'react';
import DropdownHelp from '../components/DropdownHelp';

function Header() {
  return (
    <header className="flex justify-between items-center p-4">
      <h1>My Application</h1>
      <DropdownHelp align="right" />
    </header>
  );
}`}
                </code>
              </pre>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Features</h2>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-green-500 mt-0.5 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  <strong>Accessible Design:</strong> Built with ARIA attributes
                  and keyboard navigation
                </span>
              </li>
              <li className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-green-500 mt-0.5 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  <strong>Click-Outside Detection:</strong> Automatically closes
                  when clicking elsewhere
                </span>
              </li>
              <li className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-green-500 mt-0.5 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  <strong>Keyboard Support:</strong> Closes with ESC key
                </span>
              </li>
              <li className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-green-500 mt-0.5 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  <strong>Smooth Animations:</strong> Uses transition effects
                  for a polished experience
                </span>
              </li>
              <li className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-green-500 mt-0.5 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  <strong>Dark Mode Compatible:</strong> Adjusts styling based
                  on light/dark theme
                </span>
              </li>
            </ul>
          </section>
        </div>

        <div>
          <div className="bg-gray-50 border rounded-lg p-6 sticky top-6">
            <h3 className="text-lg font-medium mb-4">API Reference</h3>

            <div className="mb-6">
              <h4 className="font-medium text-sm uppercase text-gray-500 mb-2">
                Props
              </h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-2">Name</th>
                    <th className="text-left pb-2">Type</th>
                    <th className="text-left pb-2">Default</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 font-medium">align</td>
                    <td className="py-2 text-gray-600">string</td>
                    <td className="py-2 text-gray-600">'left'</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-2 text-sm text-gray-600">
                <span className="font-medium">align</span>: Controls dropdown
                alignment. Accepts{" "}
                <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                  left
                </code>{" "}
                or{" "}
                <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                  right
                </code>
              </p>
            </div>

            <div>
              <h4 className="font-medium text-sm uppercase text-gray-500 mb-2">
                Dependencies
              </h4>
              <ul className="space-y-1 text-sm">
                <li>• React (with Hooks)</li>
                <li>• react-router-dom</li>
                <li>• Transition component</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
