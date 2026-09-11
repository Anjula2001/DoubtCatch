import * as assert from 'assert';
import * as vscode from 'vscode';
import { collectDiagnostics } from '../evidence/diagnostics';

suite('Evidence Test Suite', () => {

	test('should collect VS Code diagnostics', async () => {
		const testFile = vscode.Uri.file('/tmp/doubtcatch-test.ts');

		const diagnostic = new vscode.Diagnostic(
			new vscode.Range(0, 0, 0, 10),
			'Test error',
			vscode.DiagnosticSeverity.Error
		);

		vscode.languages.createDiagnosticCollection('doubtcatch-test')
			.set(testFile, [diagnostic]);

		const evidence = collectDiagnostics();

		const found = evidence.find(
			item => item.message === 'Test error'
		);

		assert.ok(found);
		assert.strictEqual(found?.line, 1);
		assert.strictEqual(found?.severity, 'error');
	});
});