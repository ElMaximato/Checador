export function Modal({ titulo, onClose, children }) {
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{titulo}</h2>
          <button className="x" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
