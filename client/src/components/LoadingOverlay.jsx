/**
 * Reusable Loading Overlay Component
 * Shows a full-page loading screen with spinner and message
 */

export default function LoadingOverlay({
	isLoading,
	message = "Loading...",
	submessage = "Please wait",
}) {
	if (!isLoading) return null;

	return (
		<div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
			<div className="text-center space-y-4">
				<div className="w-16 h-16 mx-auto border-4 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
				<p className="text-lg font-semibold text-white">{message}</p>
				{submessage && (
					<p className="text-sm text-white/60">{submessage}</p>
				)}
			</div>
		</div>
	);
}
