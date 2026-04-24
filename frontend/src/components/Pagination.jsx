export const Pagination = ({ page, totalPages, total, limit, onPageChange, noun = 'items' }) => {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between pt-4 border-t">
      <p className="text-sm text-gray-600">
        Showing {from} to {to} of {total} {noun}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Previous
        </button>
        {totalPages <= 7 ? (
          Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`px-3 py-1.5 text-sm border rounded-lg ${p === page ? 'bg-primary-600 text-white border-primary-600' : 'hover:bg-gray-50'}`}
            >
              {p}
            </button>
          ))
        ) : (
          <>
            {[1, 2].map(p => (
              <button key={p} onClick={() => onPageChange(p)}
                className={`px-3 py-1.5 text-sm border rounded-lg ${p === page ? 'bg-primary-600 text-white border-primary-600' : 'hover:bg-gray-50'}`}>{p}</button>
            ))}
            {page > 3 && <span className="px-2 py-1.5 text-gray-400">...</span>}
            {page > 2 && page < totalPages - 1 && (
              <button onClick={() => onPageChange(page)}
                className="px-3 py-1.5 text-sm border rounded-lg bg-primary-600 text-white border-primary-600">{page}</button>
            )}
            {page < totalPages - 2 && <span className="px-2 py-1.5 text-gray-400">...</span>}
            {[totalPages - 1, totalPages].filter(p => p > 2).map(p => (
              <button key={p} onClick={() => onPageChange(p)}
                className={`px-3 py-1.5 text-sm border rounded-lg ${p === page ? 'bg-primary-600 text-white border-primary-600' : 'hover:bg-gray-50'}`}>{p}</button>
            ))}
          </>
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};
