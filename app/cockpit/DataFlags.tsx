export default function DataFlags({ flags }: { flags: string[] }) {
  return (
    <div className={`flags${flags.length ? "" : " clean"}`}>
      {flags.length ? (
        flags.map((f, i) => (
          <p key={i}><span dangerouslySetInnerHTML={{ __html: f }} /></p>
        ))
      ) : (
        <p><span>Nothing to flag. Selection is clean.</span></p>
      )}
    </div>
  );
}
