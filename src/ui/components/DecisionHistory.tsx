import type { DecisionRecord } from "../../agent/types";

/** Karar geçmişi ve zaman çizelgesi. Kayda tıklayınca detay incelenebilir. */
export function DecisionHistoryList({
  records,
  selectedRecordId,
  onSelect,
}: {
  records: DecisionRecord[];
  selectedRecordId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="panel">
      <h2>Karar Geçmişi ({records.length})</h2>
      {records.length === 0 ? (
        <p className="no-data" data-testid="history-empty">
          veri yok — henüz karar kaydı yok
        </p>
      ) : (
        <div className="scroll-list">
          <table className="data" data-testid="history-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Parça</th>
                <th>Sıra</th>
                <th>Saat</th>
                <th>Temizlenen</th>
                <th>Doğrulama</th>
              </tr>
            </thead>
            <tbody>
              {[...records].reverse().map((record) => (
                <tr
                  key={record.id}
                  className={`clickable ${record.id === selectedRecordId ? "selected" : ""}`}
                  onClick={() => onSelect(record.id)}
                >
                  <td>{record.id}</td>
                  <td>{record.pieceType}</td>
                  <td>{record.pieceIndex}</td>
                  <td>{new Date(record.createdAt).toLocaleTimeString("tr-TR")}</td>
                  <td>
                    {record.linesAfter === null
                      ? "veri yok"
                      : record.linesAfter}
                  </td>
                  <td>
                    {!record.applied
                      ? "—"
                      : record.verification?.ok
                        ? "✓"
                        : "✗"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
