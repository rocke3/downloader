const express = require("express");
const bodyParser = require("body-parser");
const ytmp4 = require("youtube-dl-exec");
const { fbdl, igdl } = require("ruhend-scraper");
const multer = require("multer");
const upload = multer({ dest: "files/" });
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const http = require("http");

const server = http.createServer(app);
const io = new Server(server);
const port = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.post("/fbdownload", async (req, res) => {
	const url = req.body.url;
	const isFb = url?.includes("facebook.com") || url?.includes("fb.watch") || url?.includes("m.facebook.com") || url?.includes("fb.com");
	const isIg = url?.includes("instagram.com") || url?.includes("instagr.am") || url?.includes("instagr.com") || url?.includes("m.instagram.com") || url?.includes("ig.com");
	const isYt = url?.includes("youtube.com") || url?.includes("youtu.be") || url?.includes("m.youtube.com");
	let data = { thumbnail: "", title: "", urls: [] };

	if (isFb) {
		try {
			const res = await fbdl(url);
			const result = await res.data;
			data.title = "Facebook Video";
			for (const item of result) {
				data.thumbnail = item.thumbnail ?? "";
				data.urls.push({ resolution: item.resolution ?? "", url: item.url ?? "" });
			}
		} catch (error) {
			data = { error: true };
		}
	}
	if (isIg) {
		try {
			let res = await igdl(url);
			const result = await res.data;
			data.title = "Instagram Video";
			for (const item of result) {
				data.thumbnail = item.thumbnail ?? "";
				data.urls.push({ resolution: "Download", url: item.url ?? "" });
			}
		} catch (error) {
			data = { error: true };
		}
	}
	if (isYt) {
		try {
			await ytmp4(url, {
				dumpSingleJson: true,
			}).then((output) => {
				data.thumbnail = output.thumbnail;
				for (const item of output.requested_downloads) {
					data.urls.push({ resolution: item.format_note, url: item.url ?? "" });
				}
			});
		} catch (error) {
			data = { error: true, error_message: error };
		}
		data.title = "Youtube Video";
	}
	res.json({ data: data });
});

app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "public", "upload.html"));
});

app.get("/file", (req, res) => {
	res.sendFile(path.join(__dirname, "public", "files.html"));
});

app.get("/files", (req, res) => {
	const filesDir = path.join(__dirname, "files");
	fs.readdir(filesDir, (err, files) => {
		if (err) {
			console.error("Error reading directory:", err);
			return res.status(500).json({ error: "Failed to read files directory" });
		}
		const filteredFiles = files.filter((file) => file !== ".DS_Store");
		res.json({ files: filteredFiles });
	});
});

app.post("/delete", (req, res) => {
	const fileName = req.body.fileName;
	const filePath = path.join(__dirname, "files", fileName);
	fs.unlink(filePath, (err) => {
		if (err) {
			console.error("Error deleting file:", err);
			res.json({ error: true });
		}
		res.json({ success: true });
	});
});

app.post("/upload", upload.array("files"), (req, res) => {
	if (!req.files || req.files.length === 0) {
		return res.status(400).json({ error: "No files were uploaded." });
	}

	req.files.forEach((file) => {
		const originalName = file.originalname;
		const oldPath = file.path;
		const newPath = path.join(__dirname, "files", originalName);

		fs.rename(oldPath, newPath, (err) => {
			if (err) {
				res.json({ error: "Failed to upload file" });
			}
		});
	});

	res.json({ success: "Files uploaded successfully" });
});

io.on("connection", (socket) => {
	socket.on("startDownload", async (fileUrl) => {
		const fileName = path.basename(fileUrl);
		const outputPath = path.join(__dirname, "files", fileName);

		if (!fs.existsSync(path.join(__dirname, "files"))) {
			fs.mkdirSync(path.join(__dirname, "files"));
		}

		try {
			await downloadFile(fileUrl, outputPath, socket);
			socket.emit("downloadComplete", "File downloaded successfully");
		} catch (error) {
			socket.emit("downloadError", "Failed to download file: " + error.message);
		}
	});

	socket.on("disconnect", () => {});
});

server.listen(port, () => {
	console.log(`Server running at http://localhost:${port}`);
});

async function downloadFile(url, outputPath, socket) {
	try {
		const response = await axios({
			method: "GET",
			url: url,
			responseType: "stream",
			timeout: 9000000,
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
			},
			maxContentLength: Infinity,
			maxBodyLength: Infinity,
		});

		const totalSize = parseInt(response.headers["content-length"], 10);
		let downloadedSize = 0;

		const writer = fs.createWriteStream(outputPath);

		response.data.on("data", (chunk) => {
			downloadedSize += chunk.length;
			const progress = (downloadedSize / totalSize) * 100;
			socket.emit("downloadProgress", progress.toFixed(2));
		});

		response.data.pipe(writer);

		return new Promise((resolve, reject) => {
			writer.on("finish", resolve);
			writer.on("error", reject);
		});
	} catch (error) {
		console.error("Error downloading file:", error.message);
		throw error;
	}
}
