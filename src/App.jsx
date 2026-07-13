import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import "./App.css";
import { loadJobs, saveJobs } from "./storage";

const blankJob = { name: "", client: "", jobNumber: "", cratePrefix: "" };

function uid() {
  return crypto.randomUUID();
}

function App() {
  const [jobs, setJobs] = useState([]);
  const [storageReady, setStorageReady] = useState(false);
  const [jobForm, setJobForm] = useState(blankJob);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedCrateId, setSelectedCrateId] = useState("");
  const [saved, setSaved] = useState(true);

  useEffect(() => {
  async function restoreJobs() {
    try {
      const storedJobs = await loadJobs();
      setJobs(storedJobs);
    } catch (error) {
      console.error("Unable to load saved jobs:", error);
    } finally {
      setStorageReady(true);
    }
  }

  restoreJobs();
}, []);

useEffect(() => {
  if (!storageReady) return;

  setSaved(false);

  const timer = setTimeout(async () => {
    try {
      await saveJobs(jobs);
      setSaved(true);
    } catch (error) {
      console.error("Unable to save jobs:", error);
      setSaved(false);
    }
  }, 500);

  return () => clearTimeout(timer);
}, [jobs, storageReady]);

  const selectedJob = jobs.find(j => j.id === selectedJobId);
  const selectedCrate = selectedJob?.crates.find(c => c.id === selectedCrateId);

  function updateJob(job) {
    setJobs(jobs.map(j => j.id === job.id ? job : j));
  }

  async function exportJobPdf(job) {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 20;

  function addPageIfNeeded(requiredHeight = 20) {
    if (y + requiredHeight > pageHeight - 18) {
      doc.addPage();
      y = 20;
    }
  }

  function photoToJpeg(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        const maxWidth = 1400;
        const scale = Math.min(1, maxWidth / image.width);

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Unable to process image."));
          return;
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };

      image.onerror = () => reject(new Error("Unable to load image."));
      image.src = dataUrl;
    });
  }

  async function addPhotoSection(photos, heading) {
    if (!photos?.length) return;

    addPageIfNeeded(15);

    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text(heading, margin, y);
    doc.setFont(undefined, "normal");
    y += 7;

    const gap = 6;
    const imageWidth = (pageWidth - margin * 2 - gap) / 2;
    const imageHeight = 58;

    for (let index = 0; index < photos.length; index += 2) {
      addPageIfNeeded(imageHeight + 9);

      const pair = photos.slice(index, index + 2);

      for (let position = 0; position < pair.length; position += 1) {
        const photo = pair[position];

        if (!photo?.data) continue;

        try {
          const jpeg = await photoToJpeg(photo.data);
          const x = margin + position * (imageWidth + gap);

          doc.addImage(
            jpeg,
            "JPEG",
            x,
            y,
            imageWidth,
            imageHeight,
            undefined,
            "FAST"
          );
        } catch (error) {
          console.error("Unable to add photo to PDF:", error);
        }
      }

      y += imageHeight + 8;
    }
  }

  doc.setFontSize(22);
  doc.setFont(undefined, "bold");
  doc.text(job.name || "Inventory Report", margin, y);
  y += 11;

  doc.setFontSize(11);
  doc.setFont(undefined, "normal");
  doc.text(`Client: ${job.client || "Not entered"}`, margin, y);
  y += 7;
  doc.text(`Job Number: ${job.jobNumber || "Not entered"}`, margin, y);
  y += 7;
  doc.text(`Report Date: ${new Date().toLocaleDateString()}`, margin, y);
  y += 12;

  for (let crateIndex = 0; crateIndex < (job.crates || []).length; crateIndex += 1) {
    const crate = job.crates[crateIndex];

    const crateName =
      crate.id ||
      crate.name ||
      `${job.cratePrefix || "Crate"}-${String(crateIndex + 1).padStart(4, "0")}`;

    addPageIfNeeded(30);

    doc.setFontSize(16);
    doc.setFont(undefined, "bold");
    doc.text(`Crate ${crateName}`, margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    doc.text(
      `${crate.photos?.length || 0} crate photos • ${crate.items?.length || 0} items`,
      margin,
      y
    );
    y += 9;

    if (crate.notes) {
      const crateNoteLines = doc.splitTextToSize(
        `Crate Notes: ${crate.notes}`,
        pageWidth - margin * 2
      );

      addPageIfNeeded(crateNoteLines.length * 5 + 5);
      doc.text(crateNoteLines, margin, y);
      y += crateNoteLines.length * 5 + 5;
    }

    await addPhotoSection(crate.photos, "Crate Photos");

    for (const item of crate.items || []) {
      addPageIfNeeded(35);

      doc.setFontSize(12);
      doc.setFont(undefined, "bold");
      doc.text(
        item.description || item.name || item.id || "Unnamed Item",
        margin + 5,
        y
      );
      y += 7;

      doc.setFontSize(10);
      doc.setFont(undefined, "normal");

      const itemDetails = [
        item.manufacturer && `Manufacturer: ${item.manufacturer}`,
        item.model && `Model: ${item.model}`,
        item.serial && `Serial Number: ${item.serial}`,
        `Quantity: ${item.quantity || 1}`,
        item.condition && `Condition: ${item.condition}`,
        item.notes && `Notes: ${item.notes}`,
      ].filter(Boolean);

      for (const detail of itemDetails) {
        const detailLines = doc.splitTextToSize(
          detail,
          pageWidth - margin * 2 - 10
        );

        addPageIfNeeded(detailLines.length * 5 + 2);
        doc.text(detailLines, margin + 5, y);
        y += detailLines.length * 5 + 2;
      }

      await addPhotoSection(item.photos, "Item Photos");
      y += 5;
    }

    y += 8;
  }

  const totalPages = doc.getNumberOfPages();

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    doc.setPage(pageNumber);
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.text(
      `Page ${pageNumber} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: "right" }
    );
  }

  const safeFileName = (job.name || "inventory")
    .replace(/[^a-z0-9]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  doc.save(`${safeFileName}-Inventory.pdf`);
}

  function updateCrate(crate) {
    updateJob({ ...selectedJob, crates: selectedJob.crates.map(c => c.id === crate.id ? crate : c) });
  }

  function createJob() {
    if (!jobForm.name || !jobForm.client || !jobForm.cratePrefix) return alert("Job name, client, and crate prefix are required.");

    const job = { id: uid(), ...jobForm, crates: [], createdAt: new Date().toLocaleString() };
    setJobs([job, ...jobs]);
    setSelectedJobId(job.id);
    setSelectedCrateId("");
    setJobForm(blankJob);
  }

  function deleteJob(id) {
    const job = jobs.find(j => j.id === id);
    if (!confirm(`Delete job "${job.name}" and all crates, items, and photos?`)) return;
    setJobs(jobs.filter(j => j.id !== id));
    setSelectedJobId("");
    setSelectedCrateId("");
  }

  function createCrate() {
    const num = String(selectedJob.crates.length + 1).padStart(4, "0");
    const crate = { id: `${selectedJob.cratePrefix}-${num}`, photos: [], items: [], notes: "", createdAt: new Date().toLocaleString() };
    updateJob({ ...selectedJob, crates: [...selectedJob.crates, crate] });
    setSelectedCrateId(crate.id);
  }

  function deleteCrate(id) {
    const crate = selectedJob.crates.find(c => c.id === id);
    if (!confirm(`Delete crate ${id}? This will delete ${crate.items.length} items and ${crate.photos.length} crate photos.`)) return;
    updateJob({ ...selectedJob, crates: selectedJob.crates.filter(c => c.id !== id) });
    setSelectedCrateId("");
  }

  function addItem() {
    const num = String(selectedCrate.items.length + 1).padStart(3, "0");
    const item = {
      id: `${selectedCrate.id}-I${num}`,
      description: "",
      manufacturer: "",
      model: "",
      serial: "",
      quantity: 1,
      condition: "New / Good",
      notes: "",
      photos: []
    };
    updateCrate({ ...selectedCrate, items: [...selectedCrate.items, item] });
  }

  function updateItem(id, field, value) {
    updateCrate({
      ...selectedCrate,
      items: selectedCrate.items.map(i => i.id === id ? { ...i, [field]: value } : i)
    });
  }

  function deleteItem(id) {
    const item = selectedCrate.items.find(i => i.id === id);
    if (!confirm(`Delete item ${id}? This will delete ${item.photos.length} item photos.`)) return;
    updateCrate({ ...selectedCrate, items: selectedCrate.items.filter(i => i.id !== id) });
  }

  function readPhotos(files, callback) {
    Promise.all(Array.from(files).map(file => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve({ id: uid(), name: file.name, data: reader.result, addedAt: new Date().toLocaleString() });
      reader.readAsDataURL(file);
    }))).then(callback);
  }

  function addCratePhotos(files) {
    readPhotos(files, photos => updateCrate({ ...selectedCrate, photos: [...selectedCrate.photos, ...photos] }));
  }

  function deleteCratePhoto(id) {
    if (!confirm("Delete this crate photo?")) return;
    updateCrate({ ...selectedCrate, photos: selectedCrate.photos.filter(p => p.id !== id) });
  }

  function addItemPhotos(itemId, files) {
    readPhotos(files, photos => updateCrate({
      ...selectedCrate,
      items: selectedCrate.items.map(i => i.id === itemId ? { ...i, photos: [...i.photos, ...photos] } : i)
    }));
  }

  function deleteItemPhoto(itemId, photoId) {
    if (!confirm("Delete this item photo?")) return;
    updateCrate({
      ...selectedCrate,
      items: selectedCrate.items.map(i => i.id === itemId ? { ...i, photos: i.photos.filter(p => p.id !== photoId) } : i)
    });
  }

  function exportCSV() {
    if (!selectedJob) return;
    const rows = [["Job","Client","Job Number","Crate","Item","Description","Manufacturer","Model","Serial","Qty","Condition","Notes","Photos"]];
    selectedJob.crates.forEach(c => c.items.forEach(i => rows.push([
      selectedJob.name, selectedJob.client, selectedJob.jobNumber, c.id, i.id, i.description, i.manufacturer, i.model, i.serial, i.quantity, i.condition, i.notes, i.photos.length
    ])));
    const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${selectedJob.name || "cratepro"}-inventory.csv`;
    a.click();
  }

  const totals = useMemo(() => {
    if (!selectedJob) return { crates: 0, items: 0, photos: 0 };
    return {
      crates: selectedJob.crates.length,
      items: selectedJob.crates.reduce((t, c) => t + c.items.length, 0),
      photos: selectedJob.crates.reduce((t, c) => t + c.photos.length + c.items.reduce((x, i) => x + i.photos.length, 0), 0)
    };
  }, [selectedJob]);

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>CratePro</h1>
          <p>Field Inventory MVP</p>
        </div>
        <span className={saved ? "saved" : "saving"}>{saved ? "● All changes saved" : "● Saving..."}</span>
      </header>

      <main className="layout">
        <section className="panel">
          <h2>New Job</h2>
          <input placeholder="Job Name" value={jobForm.name} onChange={e => setJobForm({ ...jobForm, name: e.target.value })} />
          <input placeholder="Client" value={jobForm.client} onChange={e => setJobForm({ ...jobForm, client: e.target.value })} />
          <input placeholder="Job Number" value={jobForm.jobNumber} onChange={e => setJobForm({ ...jobForm, jobNumber: e.target.value })} />
          <input placeholder="Crate Prefix" value={jobForm.cratePrefix} onChange={e => setJobForm({ ...jobForm, cratePrefix: e.target.value })} />
          <button className="primary" onClick={createJob}>Create Job</button>

          <h2>Jobs</h2>
          {jobs.map(job => (
            <div className="job-row" key={job.id}>
              <button className="job-card" onClick={() => { setSelectedJobId(job.id); setSelectedCrateId(""); }}>
                <strong>{job.name}</strong>
                <span>{job.client}</span>
                <small>Job #{job.jobNumber}</small>
              </button>
              <button className="danger small" onClick={() => deleteJob(job.id)}>Delete</button>
              <button
  className="primary small"
  onClick={() => exportJobPdf(job)}
>
  Export PDF
</button>
            </div>
          ))}
        </section>

        <section className="content">
          {!selectedJob && <h2>Select or create a job</h2>}

          {selectedJob && (
            <>
              <div className="project-header">
                <div>
                  <h2>{selectedJob.name}</h2>
                  <p>{selectedJob.client} • {selectedJob.jobNumber}</p>
                  <p>{totals.crates} crates • {totals.items} items • {totals.photos} photos</p>
                </div>
                <button className="secondary" onClick={createCrate}>+ New Crate</button>
              </div>

              <button onClick={exportCSV}>Export CSV</button>

              <h3>Crates</h3>
              {selectedJob.crates.map(crate => (
                <div className="crate-line" key={crate.id}>
                  <button className="crate-card" onClick={() => setSelectedCrateId(crate.id)}>
                    <h3>{crate.id}</h3>
                    <p>{crate.photos.length} crate photos • {crate.items.length} items</p>
                  </button>
                  <button className="danger small" onClick={() => deleteCrate(crate.id)}>Delete</button>
                </div>
              ))}
            </>
          )}

          {selectedCrate && (
            <section className="workflow">
              <h2>{selectedCrate.id}</h2>

              <label className="upload">
                Add Crate Photos from Camera / Photos / Files
                <input type="file" accept="image/*" multiple onChange={e => addCratePhotos(e.target.files)} />
              </label>

              <div className="photo-grid">
                {selectedCrate.photos.map(photo => (
                  <div className="photo-wrap" key={photo.id}>
                    <img src={photo.data} alt={photo.name} />
                    <button className="danger small" onClick={() => deleteCratePhoto(photo.id)}>Delete</button>
                  </div>
                ))}
              </div>

              <button className="primary" onClick={addItem}>+ Add Item</button>

              {selectedCrate.items.map(item => (
                <div className="item-card" key={item.id}>
                  <div className="item-head">
                    <h3>{item.id}</h3>
                    <button className="danger small" onClick={() => deleteItem(item.id)}>Delete Item</button>
                  </div>

                  <input placeholder="Description" value={item.description} onChange={e => updateItem(item.id, "description", e.target.value)} />
                  <input placeholder="Manufacturer" value={item.manufacturer} onChange={e => updateItem(item.id, "manufacturer", e.target.value)} />
                  <input placeholder="Model" value={item.model} onChange={e => updateItem(item.id, "model", e.target.value)} />
                  <input placeholder="Serial Number" value={item.serial} onChange={e => updateItem(item.id, "serial", e.target.value)} />
                  <input type="number" placeholder="Quantity" value={item.quantity} onChange={e => updateItem(item.id, "quantity", e.target.value)} />
                  <input placeholder="Condition" value={item.condition} onChange={e => updateItem(item.id, "condition", e.target.value)} />
                  <textarea placeholder="Notes" value={item.notes} onChange={e => updateItem(item.id, "notes", e.target.value)} />

                  <label className="upload">
                    Add Item Photos from Camera / Photos / Files
                    <input type="file" accept="image/*" multiple onChange={e => addItemPhotos(item.id, e.target.files)} />
                  </label>

                  <div className="photo-grid">
                    {item.photos.map(photo => (
                      <div className="photo-wrap" key={photo.id}>
                        <img src={photo.data} alt={photo.name} />
                        <button className="danger small" onClick={() => deleteItemPhoto(item.id, photo.id)}>Delete</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;