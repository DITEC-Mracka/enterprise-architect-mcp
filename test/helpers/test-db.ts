import { DatabaseSync } from "node:sqlite";

/**
 * Creates an in-memory SQLite database with the EA schema and seed data for testing.
 */
export function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");

  db.exec(`
    CREATE TABLE t_package (
      Package_ID INTEGER PRIMARY KEY,
      Name TEXT,
      Parent_ID INTEGER DEFAULT 0,
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
      Complexity TEXT
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
      Pos INTEGER
    );

    CREATE TABLE t_operation (
      OperationID INTEGER PRIMARY KEY,
      Object_ID INTEGER,
      Name TEXT,
      Type TEXT,
      Scope TEXT,
      Stereotype TEXT,
      Notes TEXT,
      Pos INTEGER
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
      End_Object_ID INTEGER
    );

    CREATE TABLE t_diagram (
      Diagram_ID INTEGER PRIMARY KEY,
      Name TEXT,
      Diagram_Type TEXT,
      Package_ID INTEGER,
      Notes TEXT
    );

    CREATE TABLE t_diagramobjects (
      Diagram_ID INTEGER,
      Object_ID INTEGER,
      Sequence INTEGER
    );

    CREATE TABLE t_objectscenarios (
      Object_ID INTEGER,
      Scenario TEXT,
      ScenarioType TEXT,
      XMLContent TEXT,
      Notes TEXT,
      ea_guid TEXT
    );
  `);

  // Seed packages
  const insertPkg = db.prepare(
    "INSERT INTO t_package (Package_ID, Name, Parent_ID, TPos) VALUES (?, ?, ?, ?)"
  );
  insertPkg.run(1, "Model", 0, 0);
  insertPkg.run(2, "Analýza", 1, 0);
  insertPkg.run(3, "Use Cases", 2, 0);
  insertPkg.run(4, "Architektúra", 1, 1);

  // Seed objects
  const insertObj = db.prepare(
    `INSERT INTO t_object (Object_ID, Object_Type, Name, Alias, Stereotype, Package_ID, Note, Status, Author)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertObj.run(1, "UseCase", "Správa väzňov", "UC_001", "UseCase", 3, "Hlavný use case pre správu väzňov v systéme", "Approved", "admin");
  insertObj.run(2, "Class", "Väzeň", null, "Entity", 3, "Entita reprezentujúca väzňa", "Approved", "admin");
  insertObj.run(3, "Screen", "Zoznam väzňov", null, "Obrazovka", 3, "Obrazovka so zoznamom väzňov", "Proposed", "admin");
  insertObj.run(4, "Activity", "Spracovanie žiadosti", null, null, 3, null, null, "admin");
  insertObj.run(5, "Class", "Osoba", "Person", "Entity", 2, "Základná entita pre osobu v systéme ZVJS", "Approved", "admin");

  // Seed attributes for Väzeň (Object_ID=2)
  const insertAttr = db.prepare(
    `INSERT INTO t_attribute (ID, Object_ID, Name, Type, Scope, Stereotype, Notes, LowerBound, UpperBound, "Default", Pos)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertAttr.run(1, 2, "meno", "String", "Public", null, "Krstné meno", "1", "1", null, 0);
  insertAttr.run(2, 2, "priezvisko", "String", "Public", null, "Priezvisko väzňa", "1", "1", null, 1);
  insertAttr.run(3, 2, "datumNarodenia", "Date", "Public", null, null, "0", "1", null, 2);

  // Seed operations for Väzeň (Object_ID=2)
  const insertOp = db.prepare(
    "INSERT INTO t_operation (OperationID, Object_ID, Name, Type, Scope, Stereotype, Notes, Pos) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  insertOp.run(1, 2, "getFullName", "String", "Public", null, "Returns full name", 0);
  insertOp.run(2, 2, "setMeno", "void", "Public", null, null, 1);

  // Seed operation params
  const insertParam = db.prepare(
    "INSERT INTO t_operationparams (OperationID, Name, Type, Kind, Notes, Pos) VALUES (?, ?, ?, ?, ?, ?)"
  );
  insertParam.run(2, "meno", "String", "in", "Nové meno", 0);

  // Seed connectors
  const insertConn = db.prepare(
    `INSERT INTO t_connector (Connector_ID, Connector_Type, SubType, Name, Direction, Stereotype, Notes, SourceCard, DestCard, Start_Object_ID, End_Object_ID)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertConn.run(1, "Realisation", null, null, "Source -> Destination", null, null, null, null, 3, 1);
  insertConn.run(2, "Association", null, "uses", "Source -> Destination", null, null, "1", "*", 1, 2);
  insertConn.run(3, "Dependency", null, null, "Source -> Destination", null, null, null, null, 2, 5);

  // Seed diagram
  db.prepare(
    "INSERT INTO t_diagram (Diagram_ID, Name, Diagram_Type, Package_ID, Notes) VALUES (?, ?, ?, ?, ?)"
  ).run(1, "UC Správa väzňov", "Use Case", 3, "Diagram use casov");

  // Seed diagram objects
  const insertDiagObj = db.prepare(
    "INSERT INTO t_diagramobjects (Diagram_ID, Object_ID, Sequence) VALUES (?, ?, ?)"
  );
  insertDiagObj.run(1, 1, 1);
  insertDiagObj.run(1, 2, 2);
  insertDiagObj.run(1, 3, 3);

  // Seed scenarios for UseCase (Object_ID=1)
  const insertScenario = db.prepare(
    "INSERT INTO t_objectscenarios (Object_ID, Scenario, ScenarioType, XMLContent, Notes, ea_guid) VALUES (?, ?, ?, ?, ?, ?)"
  );
  insertScenario.run(
    1, "Basic Path", "Basic Path",
    '<path><step name="Používateľ otvorí zoznam" level="0" guid="{AAA-111}"/><step name="Systém zobrazí údaje" level="0" guid="{AAA-222}"/></path>',
    null, "{BP-001}"
  );
  insertScenario.run(
    1, "Alternate 1", "Alternate",
    '<path><step name="Väzeň neexistuje" level="0" guid="{BBB-111}"/></path>',
    "Alternatívny scenár", "{ALT-001}"
  );

  return db;
}
