import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface TestDb {
  db: DatabaseSync;
  dbPath: string;
  cleanup: () => void;
}

/**
 * Creates a file-based .qea SQLite database with the EA schema and seed data for testing.
 * Carries the model's awkward shapes: entity-encoded notes, uppercase Slovak diacritics,
 * StyleEx tokens, missing t_diagramlinks rows, duplicate names, reserved-word columns.
 */
export function createTestDb(): TestDb {
  const tempDir = mkdtempSync(join(tmpdir(), "ea-test-"));
  const dbPath = join(tempDir, "test-model.qea");
  const db = new DatabaseSync(dbPath);

  db.exec(`
    CREATE TABLE t_package (
      Package_ID INTEGER PRIMARY KEY,
      Name TEXT,
      Parent_ID INTEGER DEFAULT 0,
      ea_guid TEXT,
      TPos INTEGER DEFAULT 0
    );

    CREATE TABLE t_object (
      Object_ID INTEGER PRIMARY KEY,
      Object_Type TEXT,
      Name TEXT,
      Alias TEXT,
      Stereotype TEXT,
      Package_ID INTEGER,
      Note TEXT,
      Status TEXT,
      Author TEXT,
      CreatedDate TEXT,
      ModifiedDate TEXT,
      Phase TEXT,
      Complexity TEXT,
      ea_guid TEXT
    );

    CREATE TABLE t_attribute (
      ID INTEGER PRIMARY KEY,
      Object_ID INTEGER,
      Name TEXT,
      Type TEXT,
      Scope TEXT,
      Stereotype TEXT,
      Notes TEXT,
      LowerBound TEXT,
      UpperBound TEXT,
      "Default" TEXT,
      Pos INTEGER,
      ea_guid TEXT
    );

    CREATE TABLE t_operation (
      OperationID INTEGER PRIMARY KEY,
      Object_ID INTEGER,
      Name TEXT,
      Type TEXT,
      Scope TEXT,
      Stereotype TEXT,
      Notes TEXT,
      Pos INTEGER,
      ea_guid TEXT
    );

    CREATE TABLE t_operationparams (
      OperationID INTEGER,
      Name TEXT,
      Type TEXT,
      Kind TEXT,
      Notes TEXT,
      Pos INTEGER
    );

    CREATE TABLE t_connector (
      Connector_ID INTEGER PRIMARY KEY,
      Connector_Type TEXT,
      SubType TEXT,
      Name TEXT,
      Direction TEXT,
      Stereotype TEXT,
      Notes TEXT,
      SourceCard TEXT,
      DestCard TEXT,
      Start_Object_ID INTEGER,
      End_Object_ID INTEGER,
      SourceRole TEXT,
      DestRole TEXT,
      StyleEx TEXT
    );

    CREATE TABLE t_diagram (
      Diagram_ID INTEGER PRIMARY KEY,
      Name TEXT,
      Diagram_Type TEXT,
      Package_ID INTEGER,
      Notes TEXT,
      ea_guid TEXT
    );

    CREATE TABLE t_diagramobjects (
      Diagram_ID INTEGER,
      Object_ID INTEGER,
      Sequence INTEGER
    );

    CREATE TABLE t_diagramlinks (
      DiagramID INTEGER,
      ConnectorID INTEGER,
      Hidden INTEGER DEFAULT 0
    );

    CREATE TABLE t_objectscenarios (
      Object_ID INTEGER,
      Scenario TEXT,
      ScenarioType TEXT,
      XMLContent TEXT,
      Notes TEXT,
      ea_guid TEXT
    );

    CREATE TABLE t_objectconstraint (
      Object_ID INTEGER,
      "Constraint" TEXT,
      ConstraintType TEXT,
      Weight REAL DEFAULT 0,
      Notes TEXT,
      Status TEXT
    );

    CREATE UNIQUE INDEX uq_attribute_eaguid ON t_attribute(ea_guid);
    CREATE UNIQUE INDEX uq_operation_eaguid ON t_operation(ea_guid);
  `);

  // --- Seed packages (including a duplicate name) ---
  const insertPkg = db.prepare(
    "INSERT INTO t_package (Package_ID, Name, Parent_ID, ea_guid, TPos) VALUES (?, ?, ?, ?, ?)"
  );
  insertPkg.run(1, "Model", 0, "{PKG-0001}", 0);
  insertPkg.run(2, "Analýza", 1, "{PKG-0002}", 0);
  insertPkg.run(3, "Use Cases", 2, "{PKG-0003}", 0);
  insertPkg.run(4, "Architektúra", 1, "{PKG-0004}", 1);
  insertPkg.run(5, "Use Cases", 4, "{PKG-0005}", 0); // duplicate name under different parent

  // --- Seed objects ---
  const insertObj = db.prepare(
    `INSERT INTO t_object (Object_ID, Object_Type, Name, Alias, Stereotype, Package_ID, Note, Status, Author, ea_guid)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertObj.run(1, "UseCase", "Správa väzňov", "UC_001", "UseCase", 3,
    "Hlavný use case pre správu väzňov v systéme", "Approved", "admin", "{OBJ-0001}");
  insertObj.run(2, "Class", "Väzeň", null, "Entity", 3,
    "Entita reprezentujúca väzňa", "Approved", "admin", "{OBJ-0002}");
  insertObj.run(3, "Screen", "Zoznam väzňov", null, "Obrazovka", 3,
    "Obrazovka so zoznamom väzňov", "Proposed", "admin", "{OBJ-0003}");
  insertObj.run(4, "Activity", "Spracovanie žiadosti", null, null, 3,
    null, null, "admin", "{OBJ-0004}");
  insertObj.run(5, "Class", "Osoba", "Person", "Entity", 2,
    "Základná entita pre osobu v systéme ZVJS", "Approved", "admin", "{OBJ-0005}");
  // Entity-encoded note + uppercase Slovak name (R3 test shapes)
  insertObj.run(6, "Class", "PRÁVNICKÁ OSOBA", null, "Entity", 3,
    "Pr&#225;vnick&#225; osoba (&lt;&lt;modul&gt;&gt;) - D&#225;tum spracovania &lt;&gt; null",
    "Approved", "admin", "{OBJ-0006}");
  // Duplicate element name in different package
  insertObj.run(7, "Class", "Osoba", null, "Entity", 5,
    "Osoba v architektúre", "Approved", "admin", "{OBJ-0007}");
  // Element with a long note for preview truncation testing
  insertObj.run(8, "Requirement", "Požiadavka na výživné", null, null, 3,
    "A".repeat(300), "Proposed", "admin", "{OBJ-0008}");

  // --- Seed attributes with ea_guid (for R1 feature link resolution) ---
  const insertAttr = db.prepare(
    `INSERT INTO t_attribute (ID, Object_ID, Name, Type, Scope, Stereotype, Notes, LowerBound, UpperBound, "Default", Pos, ea_guid)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertAttr.run(1, 2, "meno", "String", "Public", null, "Krstné meno", "1", "1", null, 0, "{ATTR-0001}");
  insertAttr.run(2, 2, "priezvisko", "String", "Public", null, "Priezvisko väzňa", "1", "1", null, 1, "{ATTR-0002}");
  insertAttr.run(3, 2, "datumNarodenia", "Date", "Public", null, null, "0", "1", null, 2, "{ATTR-0003}");
  // Attribute with entity-encoded notes
  insertAttr.run(4, 6, "názov", "String", "Public", null, "N&#225;zov pr&#225;vnickej osoby", "1", "1", null, 0, "{ATTR-0004}");

  // --- Seed operations with ea_guid ---
  const insertOp = db.prepare(
    "INSERT INTO t_operation (OperationID, Object_ID, Name, Type, Scope, Stereotype, Notes, Pos, ea_guid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  insertOp.run(1, 2, "getFullName", "String", "Public", null, "Returns full name", 0, "{OP-0001}");
  insertOp.run(2, 2, "setMeno", "void", "Public", null, null, 1, "{OP-0002}");

  // --- Seed operation params ---
  const insertParam = db.prepare(
    "INSERT INTO t_operationparams (OperationID, Name, Type, Kind, Notes, Pos) VALUES (?, ?, ?, ?, ?, ?)"
  );
  insertParam.run(2, "meno", "String", "in", "Nové meno", 0);

  // --- Seed connectors with StyleEx and roles ---
  const insertConn = db.prepare(
    `INSERT INTO t_connector (Connector_ID, Connector_Type, SubType, Name, Direction, Stereotype, Notes, SourceCard, DestCard, Start_Object_ID, End_Object_ID, SourceRole, DestRole, StyleEx)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  // Connector with feature link: source end → attribute {ATTR-0001} (with trailing L), target end → attribute {ATTR-0004} (with trailing R)
  insertConn.run(1, "Realisation", null, null, "Source -> Destination", null, null, null, null, 3, 1,
    null, null, "LFSP={ATTR-0001}L;LFEP={attr-0004}R;");
  // Connector with roles, no feature link
  insertConn.run(2, "Association", null, "uses", "Source -> Destination", null, null, "1", "*", 1, 2,
    "Správca", "Väzeň", null);
  // Connector with no StyleEx
  insertConn.run(3, "Dependency", null, null, "Source -> Destination", null, null, null, null, 2, 5,
    null, null, null);
  // Connector for implied diagram link test: both ends (OBJ 1, 2) on diagram 1, but NO t_diagramlinks row
  // (connectors 1 and 2 are already between objects on diagram 1)
  // Connector with unresolvable feature link
  insertConn.run(4, "Association", null, null, "Source -> Destination", null, null, null, null, 6, 7,
    null, null, "LFSP={NONEXISTENT-GUID}L;");
  // Connector for feature link to operation
  insertConn.run(5, "Dependency", null, null, "Source -> Destination", null, null, null, null, 2, 6,
    null, null, "LFSP={OP-0001}L;");

  // --- Seed diagrams (including duplicate name) ---
  db.prepare(
    "INSERT INTO t_diagram (Diagram_ID, Name, Diagram_Type, Package_ID, Notes, ea_guid) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(1, "UC Správa väzňov", "Use Case", 3, "Diagram use casov", "{DIAG-0001}");
  db.prepare(
    "INSERT INTO t_diagram (Diagram_ID, Name, Diagram_Type, Package_ID, Notes, ea_guid) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(2, "UC Správa väzňov", "Use Case", 5, "Duplicitný diagram", "{DIAG-0002}"); // duplicate name

  // --- Seed diagram objects ---
  const insertDiagObj = db.prepare(
    "INSERT INTO t_diagramobjects (Diagram_ID, Object_ID, Sequence) VALUES (?, ?, ?)"
  );
  insertDiagObj.run(1, 1, 1); // Správa väzňov
  insertDiagObj.run(1, 2, 2); // Väzeň
  insertDiagObj.run(1, 3, 3); // Zoznam väzňov
  insertDiagObj.run(2, 6, 1); // PRÁVNICKÁ OSOBA
  insertDiagObj.run(2, 7, 2); // Osoba (in Architektúra)

  // --- Seed diagram links ---
  // Only connector 1 has an explicit link row; connector 2 between OBJ 1 and OBJ 2
  // (both on diagram 1) is implied — no t_diagramlinks row.
  const insertDiagLink = db.prepare(
    "INSERT INTO t_diagramlinks (DiagramID, ConnectorID, Hidden) VALUES (?, ?, ?)"
  );
  insertDiagLink.run(1, 1, 0); // explicit link for connector 1
  // connector 2 is implied (both ends on diagram 1, no row here)
  insertDiagLink.run(2, 4, 1); // hidden link on diagram 2

  // --- Seed scenarios with full step attributes ---
  const insertScenario = db.prepare(
    "INSERT INTO t_objectscenarios (Object_ID, Scenario, ScenarioType, XMLContent, Notes, ea_guid) VALUES (?, ?, ?, ?, ?, ?)"
  );
  insertScenario.run(
    1, "Basic Path", "Basic Path",
    '<path><step name="Používateľ otvorí zoznam" level="0" guid="{AAA-111}" trigger="Používateľ" uses="" result="" state="" link="{OBJ-0003}" useslist=""/><step name="Systém zobrazí údaje" level="0" guid="{AAA-222}" trigger="Systém" uses="UC_001" result="Zoznam" state="" link="" useslist="{OBJ-0002}"/></path>',
    "Poznámka k základnému scenáru", "{BP-001}"
  );
  insertScenario.run(
    1, "Alternate 1", "Alternate",
    '<path><step name="Väzeň neexistuje" level="0" guid="{BBB-111}" trigger="" uses="" result="" state="" link="" useslist=""/></path>',
    "Alternatívny scenár", "{ALT-001}"
  );

  // --- Seed constraints (R10) ---
  const insertConstraint = db.prepare(
    `INSERT INTO t_objectconstraint (Object_ID, "Constraint", ConstraintType, Notes, Status) VALUES (?, ?, ?, ?, ?)`
  );
  insertConstraint.run(1, "Spis je v stave uzatvorený", "Pre-condition", "Kontrola stavu spisu", "");
  insertConstraint.run(1, "Pravidlo nastavenia auditovanej činnosti", "Process",
    "Ak pracujeme s objektom, tak zaloguj LOG_FEO_083: ZMENA_FS_VYRADENIE", "");
  // Element with constraint but no scenario (R10/A11 test shape)
  insertConstraint.run(6, "Platná IČO", "Invariant", "Pr&#225;vnick&#225; osoba mus&#237; mať platn&#233; IČO", "");

  return {
    db,
    dbPath,
    cleanup: () => {
      try { db.close(); } catch { /* already closed */ }
      try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* best effort */ }
    },
  };
}
