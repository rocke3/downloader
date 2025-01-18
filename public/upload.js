const socket = io();
const ytDownloadForm = document.getElementById("ytDownloadForm");
const ytProgress = document.getElementById("ytProgress");
const ytResult = document.getElementById("ytResult");
// FB, Youtube Downloader

ytDownloadForm.addEventListener("submit", (e) => {
	e.preventDefault();
	const url = document.getElementById("urlInput").value;
	ytProgress.style.display = "block";
	ytResult.innerHTML = "";
	fetch("/fbdownload", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ url: url }),
	})
		.then((response) => response.json())
		.then((data) => {
			const result = data.data ?? data;
			ytProgress.style.display = "none";
			let urls = "";
			result.urls.forEach((item) => {
				urls += `<a href="${item.url}" target="_blank" class="btn">${item.resolution}</a>`;
			});
			ytResult.innerHTML = `<div style='text-align: center'>
        <div style="width: 200px; height: 200px; background-image: url(${result.thumbnail}); background-size: cover;margin:auto">
        </div>
        ${urls}
        </div>
      `;
		})
		.catch((error) => {
			console.error("Error deleting file:", error);
		});
});

function uploadFile() {
	const fileInput = document.getElementById("fileInput");
	const upload = document.getElementById("upload");
	const progress = document.getElementById("progress");
	const uploades = document.getElementById("uploades");
	upload.style.display = "none";
	progress.style.display = "block";
	const files = fileInput.files;
	if (fileInput && fileInput.files && fileInput.files.length > 0) {
		const formData = new FormData();
		let totalSize = 0;
		for (let i = 0; i < fileInput.files.length; i++) {
			totalSize += fileInput.files[i].size;
			formData.append("files", fileInput.files[i]);
		}

		// Check if total file size exceeds 5 GB (5 * 1024 * 1024 * 1024 bytes)
		if (totalSize > 5 * 1024 * 1024 * 1024) {
			showAlert("error", "❌ Total file size exceeds 5 GB limit");
			document.getElementById("downloadError").textContent = "Total file size exceeds 5 GB limit";
			upload.style.display = "block";
			progress.style.display = "none";
			return;
		}

		const xhr = new XMLHttpRequest();
		xhr.open("POST", "/upload", true);

		xhr.upload.onprogress = function (e) {
			if (e.lengthComputable) {
				const percentComplete = (e.loaded / e.total) * 100;
				document.getElementById("progressBarFill").style.width = percentComplete + "%";
				document.getElementById("progressPercent").textContent = percentComplete.toFixed(2) + "%";
			}
		};

		xhr.onload = function () {
			if (xhr.status === 200) {
				console.log("Upload completed");
				document.getElementById("progressPercent").textContent = "100%";
				upload.style.display = "block";
				progress.style.display = "none";
				// Add uploaded file names to #uploades ul
				for (let i = 0; i < files.length; i++) {
					const li = document.createElement("li");
					li.textContent = "✅ " + files[i].name;
					uploades.appendChild(li);
				}

				showAlert("success", "✅ File uploaded successfully");
			} else {
				document.getElementById("downloadError").textContent = "Upload failed: " + xhr.statusText;
				showAlert("error", "❌ Upload failed");
			}
		};

		xhr.onerror = function (event) {
			console.error("Upload failed", event);
			document.getElementById("downloadError").textContent = "Upload failed: Network error";
		};

		xhr.send(formData);
	} else {
		showAlert("error", "❌ No files selected");
		document.getElementById("downloadError").textContent = "No files selected";
	}
}
function showAlert(type, message) {
	const alertDiv = document.createElement("div");
	if (type === "success") {
		alertDiv.style.backgroundColor = "rgba(0, 128, 0, 0.5)";
	} else if (type === "error") {
		alertDiv.style.backgroundColor = "rgba(255, 0, 0, 0.5)";
	}
	alertDiv.textContent = message;
	alertDiv.style.position = "fixed";
	alertDiv.style.top = "20px";
	alertDiv.style.right = "20px";
	alertDiv.style.color = "white";
	alertDiv.style.padding = "10px";
	alertDiv.style.borderRadius = "5px";
	alertDiv.style.zIndex = "1000";

	document.body.appendChild(alertDiv);

	setTimeout(() => {
		alertDiv.remove();
	}, 3000);
}
