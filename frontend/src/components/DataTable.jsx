import { SkeletonTable } from './SkeletonLoader';
import { EmptyState } from './EmptyState';

export const DataTable = ({ columns, data, onRowClick, loading, emptyIcon, emptyTitle, emptyDescription }) => {
  if (loading) {
    return <SkeletonTable rows={5} cols={columns.length} />;
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon || '📭'}
        title={emptyTitle || 'No data found'}
        description={emptyDescription || 'There are no items to display.'}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, rowIndex) => (
            <tr
              key={row.id || rowIndex}
              className="table-row"
              onClick={() => onRowClick && onRowClick(row)}
            >
              {columns.map((column, colIndex) => (
                <td key={colIndex} className="px-6 py-4 whitespace-nowrap">
                  {column.render ? column.render(row) : row[column.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
