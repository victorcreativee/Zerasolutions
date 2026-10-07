# Windows retail acceptance — 0.3.2

Use a dedicated test Windows computer. The installer contains the organization's configuration and opening catalog/stock snapshot. It does not copy historical sales, customers, staff passwords or private cost prices. Test sales change only the Windows test installation, not the Mac's live shop database.

1. Download the READY Windows x64 build from System Admin. Keep the recorded SHA-256 with the installer. Distribution signing is not verified.
2. Disconnect internet before running setup. Install the application, open it, and create the initial owner login. Confirm setup reports success without installing Node, PostgreSQL or other developer tools manually.
3. Confirm the organization, branch, modules, branding and active product count. Compare several stock quantities to the snapshot captured when the build was requested.
4. Add a clearly named test product with five units, suggested price 100 and minimum price 70. Confirm the owner can enter a private cost. Add a test store keeper and confirm private cost is absent from their product view.
5. Sign in as the store keeper. Sell two test units at 90 and print the receipt. Confirm the total is 180 and stock is three. Confirm a price below 70 is rejected. Test a zero-suggestion product by entering its selling price.
6. As owner, check sales history and daily totals. Record a cash count with opening cash 100 and counted cash 280; confirm the difference is zero.
7. Close Zera fully, restart Windows, remain offline, and open Zera again. Sign in and confirm the receipt, stock quantity and cash count remain correct.
8. Receive stock, create a supplier purchase, receive a partial delivery, and verify quantities and stock movements. Check that an unauthorized staff role cannot approve purchases or access owner-only information.
9. Test a voided test sale and confirm stock/payment totals reconcile. Check PDF or printer output using the client's actual printer.
10. Restore internet and optionally enroll device reporting. Disconnect internet again and confirm checkout remains available.

Record Windows version, installer build ID, printer model, pass/fail for each step and the exact visible error if any step fails. Do not use test sales as real opening records. Customer release approval requires these checks on Windows, not only automated tests on a Mac.
