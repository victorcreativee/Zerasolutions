# Daily cash counts

Operations → select a date → Cash count. Owner and Manager access follows the Operations module permissions. Counts are scoped to the business, selected branch and local-day boundaries supplied by the computer.

Expected cash = opening cash + completed cash sales + other cash in − cash out.

Cash in/out are manual drawer movements, including expenses or withdrawals; Finance expenses are not automatically deducted. Card and mobile-money sales are excluded. A nonzero difference requires a note. Counts do not modify sales, stock or Finance and do not open/close a cashier shift.

The server calculates totals and rejects a count if cash sales changed since the displayed summary. Reload and review in that case. Request keys deduplicate repeated submissions; changing the payload under an existing key is rejected. Saved records cannot be edited or deleted through this API. Record a new count to correct an earlier count. The latest 20 counts for the selected date appear with recorder, time, expected cash, counted cash, difference and note. Saved amounts remain historical snapshots after later sales/voids.

The form keeps a retry key while mounted. Reopening it or reloading the browser starts a new count; inspect saved history before resubmitting after an uncertain response. No physical cash drawer or bank integration is implied.

Validation: backend integration tests cover permissions, branch isolation, calculations, required discrepancy notes, stale cash totals and concurrent retries. Frontend production build passes. Desktop tests cover migrations/provisioning separately.
