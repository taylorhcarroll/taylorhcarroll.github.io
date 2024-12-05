// Keys for localStorage
const STORAGE_KEYS = {
    RAFFLE_DATA: "raffleData", // Store all raffle data in one JSON object
};

// Save data to localStorage
function saveToLocalStorage(data) {
    localStorage.setItem(STORAGE_KEYS.RAFFLE_DATA, JSON.stringify(data));
}

// Load data from localStorage
function loadFromLocalStorage() {
    const data = localStorage.getItem(STORAGE_KEYS.RAFFLE_DATA);
    return data ? JSON.parse(data) : null;
}

// Clear localStorage
function clearLocalStorage() {
    localStorage.removeItem(STORAGE_KEYS.RAFFLE_DATA);
    window.location.reload()
}



// Variables to track raffle state
let raffleData = {
    attendees: [],
    giftCards: [],
    winners: [],
    currentIndex: 0,
};

// Function to parse the .xlsx file and extract attendees and gift card inventory data
async function parseExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });

            // Parse Attendees sheet (assumed to be named "raffleTicketsHolidayParty")
            const attendeesSheetName = "raffleTicketsHolidayParty";
            const attendeesSheet = workbook.Sheets[attendeesSheetName];
            if (!attendeesSheet) {
                reject(new Error(`Sheet "${attendeesSheetName}" not found.`));
                return;
            }

            const attendeesData = XLSX.utils.sheet_to_json(attendeesSheet, { header: 1 });

            // Skip header row and extract "Trivia Attendance" and "Name" columns
            const attendees = attendeesData.slice(1).map((row) => {
                const triviaAttendance = parseInt(row[0], 10); // Column 1
                const name = row[1]; // Column 2
                return { name, attendance: triviaAttendance };
            }).filter((attendee) => attendee.name && attendee.attendance);

            // Parse Gift Card Inventory sheet (assumed to be named "giftCardInventory")
            const giftCardSheetName = "giftCardInventory";
            const giftCardSheet = workbook.Sheets[giftCardSheetName];
            if (!giftCardSheet) {
                reject(new Error(`Sheet "${giftCardSheetName}" not found.`));
                return;
            }

            const giftCardData = XLSX.utils.sheet_to_json(giftCardSheet, { header: 1 });
            const giftCards = [];

            // Extract gift card data from the header row and individual cells
            const headers = giftCardData[0]; // First row contains the column names
            for (let i = 0; i < headers.length; i++) {
                const location = headers[i];
                if (!location) continue;

                // Sum up all the gift card values in the column, excluding the bottom total value
                for (let j = 1; j < giftCardData.length - 1; j++) {
                    const value = parseInt(giftCardData[j][i], 10);
                    if (!isNaN(value) && value > 0) {
                        giftCards.push({ value, location });
                    }
                }
            }

            resolve({ attendees, giftCards });
        };
        reader.onerror = (e) => reject(e);
        reader.readAsArrayBuffer(file);
    });
}

// Function to render the gift card inventory
function renderGiftCardInventory(giftCards) {
    const inventoryDiv = document.getElementById("giftCardInventory");
    inventoryDiv.innerHTML = ""; // Clear previous content

    // Group gift cards by location and value
    const groupedCards = {};
    giftCards.forEach((card) => {
        if (!groupedCards[card.location]) {
            groupedCards[card.location] = {};
        }
        if (!groupedCards[card.location][card.value]) {
            groupedCards[card.location][card.value] = 0;
        }
        groupedCards[card.location][card.value]++;
    });

    // Render the grouped cards
    for (const location in groupedCards) {
        const locationDiv = document.createElement("div");
        locationDiv.className = "location";
        locationDiv.textContent = `Location: ${location}`;
        inventoryDiv.appendChild(locationDiv);

        for (const value in groupedCards[location]) {
            const valueDiv = document.createElement("div");
            valueDiv.className = "gift-card-value";
            valueDiv.textContent = `- Value: $${value}, Remaining: ${groupedCards[location][value]}`;
            inventoryDiv.appendChild(valueDiv);
        }
    }
}

// Function to render the winner list
function renderWinnerList(winners, currentIndex) {
    const winnerListDiv = document.getElementById("winnerList");
    winnerListDiv.innerHTML = "";
    winners.slice(0, currentIndex).forEach((winner, index) => {
        const winnerDiv = document.createElement("div");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = `winner-${index}`;
        checkbox.checked = winner.checked || false; // Persist checkbox state
        checkbox.addEventListener("change", () => {
            winner.checked = checkbox.checked; // Update state
            saveToLocalStorage(raffleData); // Save updated winners
            const label = document.getElementById(`winnerLabel-${index}`);
            label.style.textDecoration = checkbox.checked ? "line-through" : "none";
        });

        const label = document.createElement("label");
        label.id = `winnerLabel-${index}`;
        label.textContent = `${winner.name} - Prize: $${winner.value} from ${winner.location}`;
        label.style.marginLeft = "10px";
        label.style.textDecoration = winner.checked ? "line-through" : "none";

        winnerDiv.appendChild(checkbox);
        winnerDiv.appendChild(label);
        winnerListDiv.appendChild(winnerDiv);
    });
}

// Function to generate tickets
function generateTickets(attendees) {
    const tickets = [];
    attendees.forEach((attendee) => {
        for (let i = 0; i < attendee.attendance; i++) {
            tickets.push(attendee.name);
        }
    });
    return tickets;
}

// Shuffle an array
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Function to update the gift card inventory
function updateGiftCardInventory(winner) {
    const index = raffleData.giftCards.findIndex(
        (card) => card.value === winner.value && card.location === winner.location
    );
    if (index !== -1) {
        raffleData.giftCards.splice(index, 1); // Remove the selected gift card
        saveToLocalStorage(raffleData); // Save updated state to localStorage
        renderGiftCardInventory(raffleData.giftCards); // Refresh the inventory display
    } else {
        console.warn(`Gift card with value $${winner.value} from ${winner.location} not found.`);
    }
}

// Conduct the raffle with unique winners
function drawUniqueWinners(tickets, giftCards) {
    // Sort gift cards by value (highest first)
    const sortedGiftCards = [...giftCards].sort((a, b) => b.value - a.value);

    const shuffledTickets = shuffle(tickets);
    const winners = [];
    const winnersSet = new Set();

    sortedGiftCards.forEach((card) => {
        let winner;
        do {
            winner = shuffledTickets.pop();
        } while (winnersSet.has(winner) && shuffledTickets.length > 0);

        if (winner && !winnersSet.has(winner)) {
            winners.push({ name: winner, value: card.value, location: card.location, checked: false });
            winnersSet.add(winner);
        }
    });

    return winners;
}

// Function to show the next winner
function showNextWinner() {
    if (raffleData.currentIndex < raffleData.winners.length) {
        const winner = raffleData.winners[raffleData.currentIndex];
        alert(`Winner: ${winner.name}, Prize: $${winner.value} from ${winner.location}`);

        updateGiftCardInventory(winner);

        raffleData.currentIndex++;
        saveToLocalStorage(raffleData); // Save updated state to localStorage
        renderWinnerList(raffleData.winners, raffleData.currentIndex);
    } else {
        alert("All winners have been revealed!");
    }
}

// Attach the function to a button
document.getElementById("revealButton").addEventListener("click", showNextWinner);
// Attach the function to a button
document.getElementById("clearStateButton").addEventListener("click", clearLocalStorage);

// Load the .xlsx file and conduct the raffle
document.getElementById("uploadFile").addEventListener("change", async (event) => {
    try {
        const file = event.target.files[0];
        if (!file) {
            alert("No file selected.");
            return;
        }

        const { attendees, giftCards } = await parseExcelFile(file);
        raffleData.attendees = attendees;
        raffleData.giftCards = giftCards;

        const tickets = generateTickets(raffleData.attendees);
        renderGiftCardInventory(raffleData.giftCards);

        raffleData.winners = drawUniqueWinners(tickets, raffleData.giftCards).reverse(); // Reverse for announcement order
        raffleData.currentIndex = 0;

        saveToLocalStorage(raffleData); // Save initial state to localStorage
        alert("Raffle setup is complete! Click the button to reveal winners.");
        document.getElementById("revealButton").disabled = false;
    } catch (error) {
        console.error("Error loading file:", error);
        alert("Failed to load the file. Please check the console for details.");
    }
});

// Load raffle data on page load
window.addEventListener("load", () => {
    const savedData = loadFromLocalStorage();
    if (savedData) {
        raffleData = savedData; // Restore raffle state
        renderGiftCardInventory(raffleData.giftCards);
        renderWinnerList(raffleData.winners, raffleData.currentIndex);
        document.getElementById("revealButton").disabled =
            raffleData.currentIndex >= raffleData.winners.length;
    }
});
