export function SetupError({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-lg rounded-lg border border-red-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-red-700">HandoverAI cannot start</h1>
        <p className="mt-2 text-sm text-ink">{message}</p>
        <p className="mt-3 text-[13px] text-muted">Check the environment variables described in README.md and SERVICE_NOW_SETUP.md, then reload.</p>
        <a href="/login" className="mt-4 inline-block text-sm font-medium text-brand-600">Back to sign in</a>
      </div>
    </div>
  );
}
