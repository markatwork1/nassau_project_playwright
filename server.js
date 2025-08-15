// server.js

const express = require("express");
const fs      = require("fs");
const path    = require("path");

const app = express();
const PORT = 3000;
const dataFilePath = path.join(__dirname, "data.json");

app.use(express.json());
app.use(express.static(__dirname));

/** Read data from data.json, including deletedBuckets */
function readDataFile() {
  if (!fs.existsSync(dataFilePath)) {
    return {
      buckets: [{ name: "Uncategorized", keyword: "" }],
      notes:   [],
      deletedBuckets: []
    };
  }
  const raw = fs.readFileSync(dataFilePath, "utf-8");
  const data = JSON.parse(raw);
  // Ensure deletedBuckets key always exists
  if (!Array.isArray(data.deletedBuckets)) {
    data.deletedBuckets = [];
  }
  return data;
}

/** Write data to data.json */
function writeDataFile(data) {
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// GET /api/data -> returns { buckets, notes, deletedBuckets }
// ---------------------------------------------------------------------------
app.get("/api/data", (req, res) => {
  const data = readDataFile();
  res.json(data);
});

// ---------------------------------------------------------------------------
// POST /api/buckets -> Create a new bucket
// Body: { name: string, keyword?: string }
// Returns updated { buckets, notes, deletedBuckets }
// ---------------------------------------------------------------------------
app.post("/api/buckets", (req, res) => {
  const { name, keyword = "" } = req.body;
  if (!name.trim()) {
    return res.status(400).json({ error: "Bucket name cannot be empty." });
  }
  const data = readDataFile();
  const { buckets, deletedBuckets } = data;

  // Check for duplicate bucket name
  if (buckets.some(b => b.name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ error: "Bucket already exists." });
  }

  buckets.push({ name, keyword });
  writeDataFile(data);
  res.json({
    buckets,
    notes: data.notes,
    deletedBuckets
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/buckets/:bucketName -> Remove a bucket by name
// Moves notes from that bucket into "Uncategorized"
// Saves the removed bucket (with its notes) into deletedBuckets
// Returns updated { buckets, notes, deletedBuckets }
// ---------------------------------------------------------------------------
app.delete("/api/buckets/:bucketName", (req, res) => {
  const { bucketName } = req.params;
  const data = readDataFile();
  const { buckets, notes, deletedBuckets } = data;

  if (bucketName === "Uncategorized") {
    return res.status(400).json({ error: "Cannot remove 'Uncategorized'." });
  }

  const bucketIndex = buckets.findIndex(b => b.name === bucketName);
  if (bucketIndex === -1) {
    return res.status(404).json({ error: "Bucket not found." });
  }

  // Collect all notes that belong to this bucket
  const bucketNotes = notes
    .filter(n => n.bucketName === bucketName)
    .map(n => ({
      testNumber: n.testNumber,
      noteText:   n.noteText,
      bucketName: n.bucketName,
      timestamp:  n.timestamp
    }));

  // Add to deletedBuckets
  deletedBuckets.push({
    name: bucketName,
    keyword: buckets[bucketIndex].keyword,
    notes: bucketNotes
  });

  // Reassign notes to "Uncategorized"
  notes.forEach(n => {
    if (n.bucketName === bucketName) {
      n.bucketName = "Uncategorized";
    }
  });

  // Remove the bucket
  buckets.splice(bucketIndex, 1);

  writeDataFile(data);
  res.json({
    buckets,
    notes,
    deletedBuckets
  });
});

// ---------------------------------------------------------------------------
// POST /api/deletedBuckets/restore -> Restore a deleted bucket by name
// Body: { name: string }
// Returns updated { buckets, notes, deletedBuckets }
// ---------------------------------------------------------------------------
app.post("/api/deletedBuckets/restore", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Bucket name required to restore." });
  }

  const data = readDataFile();
  const { buckets, notes, deletedBuckets } = data;

  const index = deletedBuckets.findIndex(db => db.name === name);
  if (index === -1) {
    return res.status(404).json({ error: "Deleted bucket not found." });
  }

  const restored = deletedBuckets[index];

  // Add the bucket back
  buckets.push({ name: restored.name, keyword: restored.keyword });

  // Reassign notes that were originally in this bucket
  restored.notes.forEach(savedNote => {
    notes.forEach(n => {
      if (
        n.testNumber === savedNote.testNumber &&
        n.timestamp === savedNote.timestamp
      ) {
        n.bucketName = restored.name;
      }
    });
  });

  // Remove from deletedBuckets
  deletedBuckets.splice(index, 1);

  writeDataFile(data);
  res.json({
    buckets,
    notes,
    deletedBuckets
  });
});

// ---------------------------------------------------------------------------
// POST /api/notes -> Add/save a new note
// Body: { testNumber: string, noteText: string, bucketName: string }
// Returns { assignedBucket: string }
// ---------------------------------------------------------------------------
app.post("/api/notes", (req, res) => {
  const { testNumber, noteText, bucketName } = req.body;
  if (!testNumber.trim() || !noteText.trim()) {
    return res.status(400).json({ error: "Test Number and Note cannot be empty." });
  }

  const data = readDataFile();
  const { buckets, notes } = data;

  // Verify bucketName exists; otherwise, assign to Uncategorized
  const exists = buckets.some(b => b.name === bucketName);
  const assigned = exists ? bucketName : "Uncategorized";

  notes.push({
    testNumber: testNumber.trim(),
    noteText:   noteText.trim(),
    bucketName: assigned,
    timestamp:  new Date().toISOString()
  });

  writeDataFile(data);
  res.json({ assignedBucket: assigned });
});

// ---------------------------------------------------------------------------
// Start the server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});