import { useQuery } from "@tanstack/react-query";
import { nativeSnapshot } from "@/lib/native-projection";

/** Native SLE values, never inferred legacy balance-after or reservation events. */
export function NativeLedger() {
  const query = useQuery({ queryKey: ["native-ledger"], queryFn: nativeSnapshot });
  if (query.isError) return <p role="alert">{query.error.message}</p>;
  if (!query.data) return <p>تحميل السجل الأصلي…</p>;
  return (
    <section dir="rtl">
      <h1>سجل ERPNext — {query.data.company}</h1>
      <table>
        <thead>
          <tr>
            <th>المستند</th>
            <th>القطعة</th>
            <th>الكمية</th>
            <th>تغير القيمة EUR</th>
          </tr>
        </thead>
        <tbody>
          {query.data.movements.map((entry) => (
            <tr key={entry.name}>
              <td>
                {entry.voucher_type} {entry.voucher_no}
              </td>
              <td>{entry.item_code}</td>
              <td>{entry.actual_qty}</td>
              <td>{entry.stock_value_difference}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
