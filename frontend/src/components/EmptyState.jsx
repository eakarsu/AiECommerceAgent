export const EmptyState = ({ icon = '📭', title = 'No data found', description = 'There are no items to display.', actionLabel, onAction }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="text-5xl mb-4">{icon}</span>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">{description}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn btn-primary">{actionLabel}</button>
      )}
    </div>
  );
};
