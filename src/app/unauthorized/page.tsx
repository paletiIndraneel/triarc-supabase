export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-semibold text-gray-900">
          You are not authorised to visit this page
        </h1>
        <p className="mt-3 text-gray-600">
          Your account does not have permission to access this area.
        </p>
        <a
          href="/signin"
          className="inline-flex mt-6 rounded-md bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          Back to sign in
        </a>
      </div>
    </main>
  );
}
