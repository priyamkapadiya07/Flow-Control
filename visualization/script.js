// DOM Elements
const elements = {
    protocolSelect: document.getElementById('protocol-select'),
    frameCount: document.getElementById('frame-count'),
    windowSize: document.getElementById('window-size'),
    windowSizeGroup: document.getElementById('window-size-group'),
    btnStart: document.getElementById('btn-start'),
    btnReset: document.getElementById('btn-reset'),
    btnKill: document.getElementById('btn-kill'),
    lossInput: document.getElementById('simulate-loss-input'),
    statusText: document.getElementById('status-text'),
    windowText: document.getElementById('window-text'),
    senderQueue: document.getElementById('sender-queue'),
    receiverQueue: document.getElementById('receiver-queue'),
    channel: document.getElementById('channel'),
    eventLog: document.getElementById('event-log')
};

// State
let state = {
    running: false,
    protocol: 'stop-and-wait',
    totalFrames: 10,
    windowSize: 4,
    currentFrame: 0,
    windowStart: 0,
    lostFrames: new Set(),
    timers: [],
    receivedFrames: new Set() // For tracking what receiver has
};

// Constants
const SPEED = 3500; // ms for full travel (Slower for better visibility)

// Event Listeners
elements.protocolSelect.addEventListener('change', (e) => {
    state.protocol = e.target.value;
    elements.windowSizeGroup.style.display = (state.protocol === 'stop-and-wait') ? 'none' : 'flex';
    resetSimulation();
});

elements.btnStart.addEventListener('click', startSimulation);
elements.btnReset.addEventListener('click', resetSimulation);
elements.btnKill.addEventListener('click', () => {
    const val = parseInt(elements.lossInput.value);
    if (!isNaN(val) && val > 0) {
        state.lostFrames.add(val - 1); // 0-indexed internally
        log(`Scheduled loss for Frame ${val}`, 'warning');
        elements.lossInput.value = '';
        
        // Visual feedback on button
        const originalText = elements.btnKill.innerText;
        elements.btnKill.innerText = "Set!";
        setTimeout(() => elements.btnKill.innerText = originalText, 1000);
    }
});

function log(msg, type='info') {
    const li = document.createElement('li');
    li.style.borderLeft = `3px solid ${type === 'error' ? 'red' : type === 'warning' ? 'orange' : 'skyblue'}`;
    li.innerHTML = `<span class="time">[${new Date().toLocaleTimeString().split(' ')[0]}]</span> ${msg}`;
    elements.eventLog.prepend(li);
}

function resetSimulation() {
    state.running = false;
    state.currentFrame = 0;
    state.windowStart = 0;
    state.lostFrames.clear();
    state.receivedFrames.clear();
    state.timers.forEach(clearTimeout);
    state.timers = [];

    elements.senderQueue.innerHTML = '';
    elements.receiverQueue.innerHTML = '';
    elements.channel.innerHTML = '';
    elements.eventLog.innerHTML = '';
    elements.statusText.innerText = "Ready";
}

function startSimulation() {
    if (state.running) return;
    state.running = true;
    state.totalFrames = parseInt(elements.frameCount.value);
    state.windowSize = parseInt(elements.windowSize.value);
    
    log(`Starting ${state.protocol}...`);
    runProtocol();
}

async function runProtocol() {
    switch (state.protocol) {
        case 'stop-and-wait':
            await runStopAndWait();
            break;
        case 'sliding-window':
            await runSlidingWindow(); // Simulates simple Go-Back-N behavior usually for Sliding Window demo
            break;
        case 'go-back-n':
            await runGoBackN();
            break;
        case 'selective-repeat':
            await runSelectiveRepeat();
            break;
    }
    if (state.running) {
        log("Simulation Finished", 'success');
        state.running = false;
        elements.statusText.innerText = "Finished";
    }
}

function sleep(ms) {
    return new Promise(resolve => {
        const id = setTimeout(resolve, ms);
        state.timers.push(id);
    });
}

// Visual Creators
function createPacket(id, isAck = false) {
    const packet = document.createElement('div');
    packet.className = `packet ${isAck ? 'ack' : ''}`;
    packet.innerText = isAck ? `ACK ${id}` : `F${id + 1}`;
    
    // Initial Position based on screen size
    if (window.innerWidth <= 768) {
        // Mobile: Vertical flow (Sender Top -> Receiver Bottom)
        // Send: Top -> Bottom, ACK: Bottom -> Top
        packet.style.left = '50%'; // Center horizontally
        packet.style.transform = 'translateX(-50%)'; // Clean center
        packet.style.top = isAck ? '90%' : '0%'; 
    } else {
        // Desktop: Horizontal flow
        packet.style.top = '30px';
        packet.style.left = isAck ? '90%' : '5%';
    }
    
    elements.channel.appendChild(packet);
    return packet;
}

function animatePacket(packet, isAck, duration = SPEED) {
    return new Promise(resolve => {
        const start = Date.now();
        const isMobile = window.innerWidth <= 768;
        
        // Define Start/End based on axis
        let startPos, endPos, property;
        
        if (isMobile) {
            property = 'top';
            startPos = isAck ? 90 : 0;
            endPos = isAck ? 0 : 90;
        } else {
            property = 'left';
            // Desktop fixed top reset just in case resizing happened
            packet.style.top = '30px'; 
            packet.style.transform = 'none';
            startPos = isAck ? 90 : 5;
            endPos = isAck ? 5 : 90;
        }

        function step() {
            if (!state.running) {
                packet.remove();
                return;
            }
            const progress = (Date.now() - start) / duration;
            if (progress >= 1) {
                packet.style[property] = endPos + '%';
                resolve(true); // Arrived
            } else {
                const current = startPos + (endPos - startPos) * progress;
                packet.style[property] = current + '%';
                requestAnimationFrame(step);
            }
        }
        requestAnimationFrame(step);
    });
}

// Shared helper for moving with optional loss
function movePacketWithLoss(packet, id, isLoss) {
    return new Promise(async resolve => {
        if (isLoss) {
            await animatePacket(packet, false, SPEED/2);
            packet.classList.add('lost');
            await sleep(500);
            resolve(false);
        } else {
            await animatePacket(packet, false);
            resolve(true);
        }
    });
}

function addToQueue(parent, text) {
    const el = document.createElement('div');
    el.className = 'frame-item';
    el.innerText = text;
    parent.prepend(el);
}

// 1. STOP-AND-WAIT PROTOCOL
async function runStopAndWait() {
    for (let i = 0; i < state.totalFrames; i++) {
        if (!state.running) break;
        elements.statusText.innerText = `Sending Frame ${i+1}`;
        elements.windowText.innerText = `[${i+1}]`;
        
        let ackReceived = false;
        while (!ackReceived && state.running) {
            // Send
            const isRetransmission = state.lostFrames.has(i) || state.receivedFrames.has(i); // Simplified heuristic
             
            log(isRetransmission ? `[Sender] Retransmitting Frame ${i+1}` : `[Sender] Sending Frame ${i+1}`);
            addToQueue(elements.senderQueue, `Frame ${i+1}`); 
            
            const packet = createPacket(i, false);
            const isLoss = state.lostFrames.has(i);
            
            if (isLoss) {
                await movePacketWithLoss(packet, i, true);
                log(`[Channel] Frame ${i+1} Lost!`, 'error');
                state.lostFrames.delete(i);
                log(`[Sender] Timeout. Retransmitting Frame ${i+1}...`, 'warning');
                continue; 
            }

            await movePacketWithLoss(packet, i, false);
            packet.remove();
            
            log(`[Receiver] Received Frame ${i+1}`);
            addToQueue(elements.receiverQueue, `Frame ${i+1}`);
            state.receivedFrames.add(i);
            
            // Send ACK
            log(`[Receiver] Sending ACK ${i+1}`);
            const ack = createPacket(i, true);
            await animatePacket(ack, true);
            ack.remove();
            
            log(`[Sender] ACK Received for Frame ${i+1}`);
            ackReceived = true;
        }
    }
}

// 2. SLIDING WINDOW PROTOCOL (Fixed Logic: Retransmit ONLY lost frame)
async function runSlidingWindow() {
    let base = 0;
    let nextSeqNum = 0;
    let pendingAcks = new Array(state.totalFrames).fill(false); // Track individually ACKed frames
    
    // We need to track what we have sent to manage the "window" visually
    // But for this logic, we iterate base until done
    
    while (base < state.totalFrames && state.running) {
        
        // 1. Send Loop (Fill Window)
        while (nextSeqNum < base + state.windowSize && nextSeqNum < state.totalFrames && state.running) {
             if (pendingAcks[nextSeqNum]) {
                 nextSeqNum++; // Skip if already acked (shouldn't happen in simple sequential but safe)
                 continue;
             }
             
             log(`[Sender] Sending Frame ${nextSeqNum + 1}`);
             addToQueue(elements.senderQueue, `Frame ${nextSeqNum + 1}`);
             
             // Fork the process for this frame
             handleFrameSW(nextSeqNum);
             
             nextSeqNum++;
             await sleep(500); // Small interval between sends
        }
        
        // Wait for sliding
        // The sliding happens asynchronously in handleFrameSW updates
        await sleep(100); 
    }

    async function handleFrameSW(seq) {
        // Create and Move
        const packet = createPacket(seq, false);
        const isLoss = state.lostFrames.has(seq);
        
        // If loss, we kill it halfway
        if (isLoss) {
            await movePacketWithLoss(packet, seq, true); // this removes packet and resolves false
            log(`[Channel] Frame ${seq + 1} Lost!`, 'error');
            state.lostFrames.delete(seq); // Reset loss so next try succeeds
            
            // Timeout logic
            await sleep(SPEED); // Simulate timeout duration
            log(`[Sender] Timeout for Frame ${seq + 1}. Retransmitting ONLY Frame ${seq + 1}...`, 'warning');
            
            // Retransmit THIS frame only
            // Recursively call handle for this frame
            // In a real event loop we'd schedule it, here we just invoke
            if (state.running) handleFrameSW(seq);
            
        } else {
            // Successful arrival
            const currBase = base; // capture current base for discard check (not needed in SW, accepts all)
            
            await movePacketWithLoss(packet, seq, false);
            packet.remove(); // Remove sender packet from channel
            
            log(`[Receiver] Received Frame ${seq + 1}`);
            addToQueue(elements.receiverQueue, `Frame ${seq + 1}`); // Accepted
            
            // Send ACK
            log(`[Receiver] Sending ACK ${seq + 1}`);
            const ack = createPacket(seq, true);
            await animatePacket(ack, true);
            ack.remove();
            
            log(`[Sender] Received ACK ${seq + 1}`);
            pendingAcks[seq] = true;
            
            // Slide Window Logic
            // Slide base as far as we have consecutive ACKs
            if (seq === base) {
                while (pendingAcks[base] && base < state.totalFrames) {
                    base++;
                }
                elements.windowText.innerText = `[${base+1} ... ${Math.min(base+state.windowSize, state.totalFrames)}]`;
                // Note: outer loop will pick up and send new frames if window opened
            }
        }
    }
}



// Rewriting GBN to assume proper Pipelining
async function runGoBackN() {
    let base = 0;
    let nextSeqNum = 0;
    
    // We treat this like a persistent loop state
    while (base < state.totalFrames && state.running) {
        
        // Batch Send: Send everything allowed in the window NOW
        let framesInFlight = [];
        
        let startSeq = nextSeqNum;
        let endSeq = Math.min(base + state.windowSize, state.totalFrames);
        
        for (let i = startSeq; i < endSeq; i++) {
             log(`[Sender] Sending Frame ${i + 1}`);
             addToQueue(elements.senderQueue, `Frame ${i + 1}`);
             
             // Launch packet asynchronously
             framesInFlight.push(handleFlightGBN(i));
             nextSeqNum++;
             await sleep(500); // Brief delay between dispatch
        }
        
        // Wait for this batch to resolve (either ACKs move base, or Timeout resets)
        // In GBN, if base packet is lost, base doesn't move.
        // We can check status after a "round trip time"
        
        await Promise.all(framesInFlight);
        
        // After flight, check if we need to Go Back
        // If base didn't move past the start of this batch (and we sent stuff), it means loss occurred.
        // Actually, handleFlightGBN will update base.
        
        if (base < nextSeqNum && base < state.totalFrames) {
            // If window hasn't advanced to nextSeqNum, we stalled.
            // Timeout logic is implicitly handled: if base is still `oldBase`, we reset `nextSeqNum` to `base`
            
            // To detect "Stall/Timeout", we can check if the expected ACKs arrived.
            // If we are strictly GBN, we just see: Did base increase?
            // If we sent frame X (base) and base is still X, then X was lost (or ACK lost).
            // We simulate Timeout and Go Back.
            
            // We need a way to know if "Base" failed.
            // Let's check: Did we incur any loss in this batch that strictly blocked base?
            // Simplified: If base < nextSeqNum, we simply reset nextSeqNum = base (Go Back N)
            // and continue loop.
            
            // Only timeout if we are stuck
            // logic: if (base < nextSeqNum) -> We sent frames ahead of base.
            // If they were all successful, base would be == nextSeqNum.
            // If base < nextSeqNum, it means some frames failed or were discarded.
            
             log(`[Sender] Window check: Base=${base+1}, Next=${nextSeqNum+1}. Go-Back-N if mismatch.`);
             
             if (base < nextSeqNum) {
                 log(`[Sender] Timeout! Resending Window from Frame ${base + 1}`, 'warning');
                 nextSeqNum = base; // THE GO BACK STEP
             }
        }
    }

    async function handleFlightGBN(seq) {
        // 1. Create packet
        const packet = createPacket(seq, false);
        const isLoss = state.lostFrames.has(seq);
        
        if (isLoss) {
            await movePacketWithLoss(packet, seq, true);
            log(`[Channel] Frame ${seq + 1} Lost!`, 'error');
            state.lostFrames.delete(seq);
            return; // No ACK, Base won't move
        }
        
        // 2. Travel
        await movePacketWithLoss(packet, seq, false);
        packet.remove();
        
        // 3. Receiver Logic
        // Strict GBN: Only accept if seq == receiver_expected (which tracks base from receiver POV)
        // But here we share 'base' state for simplicity, or we can assume receiver_expected == base
        // Wait, in simulation 'base' is sender's view.
        // WE MUST CHECK IF this frame is the one expected.
        // Since we process parallel, this check might race. 
        // We can simply check: Is this frame == base? 
        // If seq > base, then base was lost (or not ACKed yet).
        // Since we use global `base` which updates instantly on ACK, we can check `seq == base`.
        
        if (seq === base) {
             // Correct frame!
             log(`[Receiver] Accepted Frame ${seq + 1}`);
             addToQueue(elements.receiverQueue, `Frame ${seq + 1}`);
             
             // Send ACK
             const ack = createPacket(seq, true); // ACK seq+1 typically, or Cumulative ACK seq
             await animatePacket(ack, true);
             ack.remove();
             
             log(`[Sender] Got ACK ${seq + 1}`);
             base++; // Move window!
             elements.windowText.innerText = `[${base+1} ... ${Math.min(base+state.windowSize, state.totalFrames)}]`;
        } else {
             // Out of order! Discard.
             log(`[Receiver] Discarding Frame ${seq + 1} (Expected ${base + 1})`, 'error');
             // No ACK sent.
        }
    }
}

async function runSelectiveRepeat() {
    // Parallel sending logic is hard to visualize linearly, so we do semi-sequential
    let base = 0;
    let sentStatus = new Array(state.totalFrames).fill(false); // false: not sent/acked
    let ackStatus = new Array(state.totalFrames).fill(false);

    while (base < state.totalFrames && state.running) {
        // Send loop
        for (let i = base; i < Math.min(base + state.windowSize, state.totalFrames); i++) {
            if (!sentStatus[i]) {
                sentStatus[i] = true; // Mark as attempted
                sendFrameSR(i);
                await sleep(200);
            }
        }
        await sleep(2000); // Wait for flights
        
        // Slide base
        while (ackStatus[base] && base < state.totalFrames) {
            base++;
        }
        elements.windowText.innerText = `[${base+1} ... ${Math.min(base+state.windowSize, state.totalFrames)}]`;
    }

    async function sendFrameSR(id) {
        log(`Sender sending Frame ${id + 1}`);
        addToQueue(elements.senderQueue, `Frame ${id + 1}`);
        const packet = createPacket(id, false);
        const isLoss = state.lostFrames.has(id);
        
        // Remove loss flag immediately so retry works
        if (isLoss) state.lostFrames.delete(id);

        const arrived = await movePacketWithLoss(packet, id, isLoss);
        packet.remove();

        if (arrived) {
            log(`Receiver got Frame ${id + 1}`);
            addToQueue(elements.receiverQueue, `Frame ${id+1}`);
            
            const ack = createPacket(id, true);
            await animatePacket(ack, true);
            ack.remove();
            
            log(`Sender got ACK ${id + 1}`);
            ackStatus[id] = true;
        } else {
             log(`Frame ${id+1} Lost! NAK/Timeout.`, 'error');
             sentStatus[id] = false; // Mark to resend
        }
    }
}
