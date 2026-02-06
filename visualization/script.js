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
    packet.innerText = isAck ? `ACK ${id + 1}` : `F${id + 1}`;
    
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

// 2. SLIDING WINDOW PROTOCOL (PURE FLOW CONTROL - NO LOSS)
async function runSlidingWindow() {
    let base = 0;
    let nextSeqNum = 0;
    
    // Logic:
    // 1. Send up to window size
    // 2. Receive ACKs
    // 3. Slide
    // No retransmission logic here as per requirements.
    
    if (state.lostFrames.size > 0) {
        log('Warning: Loss simulation ignored for Pure Sliding Window (Flow Control Only)', 'warning');
        state.lostFrames.clear();
    }

    while (base < state.totalFrames && state.running) {
        
        // Send Phase
        while (nextSeqNum < base + state.windowSize && nextSeqNum < state.totalFrames && state.running) {
             log(`[Sender] Sending Frame ${nextSeqNum + 1}`);
             addToQueue(elements.senderQueue, `Frame ${nextSeqNum + 1}`);
             
             // Visual only - assuming ideal channel
             handleFrameSW(nextSeqNum);
             
             nextSeqNum++;
             await sleep(500); 
        }
        
        // Simple slide check
        // In this simulation, handleFrameSW is async. 
        // We wait a bit.
        await sleep(100);
    }

    async function handleFrameSW(seq) {
        const packet = createPacket(seq, false);
        
        // Ideally travel
        await movePacketWithLoss(packet, seq, false);
        packet.remove();
        
        log(`[Receiver] Received Frame ${seq + 1}`);
        addToQueue(elements.receiverQueue, `Frame ${seq + 1}`);
        
        // ACK
        log(`[Receiver] Sending ACK ${seq + 1}`);
        const ack = createPacket(seq, true);
        await animatePacket(ack, true);
        ack.remove();
        
        log(`[Sender] Received ACK ${seq + 1}`);
        
        // Slide Window
        if (seq >= base) {
             base = seq + 1; // Simplistic sliding for demo
             elements.windowText.innerText = `[${base+1} ... ${Math.min(base+state.windowSize, state.totalFrames)}]`;
        }
    }
}

// 3. GO-BACK-N (CUMULATIVE ACKS + DISCARD)
async function runGoBackN() {
    let base = 0;
    let nextSeqNum = 0;
    
    while (base < state.totalFrames && state.running) {
        
        let sentCountInFlight = 0;
        
        // Send Window
        while (nextSeqNum < base + state.windowSize && nextSeqNum < state.totalFrames && state.running) {
             log(`[Sender] Sending Frame ${nextSeqNum + 1}`);
             addToQueue(elements.senderQueue, `Frame ${nextSeqNum + 1}`);
             
             handleFlightGBN(nextSeqNum); // Fire and forget (it callbacks global state)
             
             nextSeqNum++;
             sentCountInFlight++;
             await sleep(SPEED / 2); // Stagger sends
        }
        
        // Wait for potential timeout or window slide
        await sleep(SPEED + 1000); 
        
        // TIMEOUT CHECK
        // If we sent frames but base didn't move past the start of this batch, assume loss/timeout.
        // We check if nextSeqNum is ahead of base.
        if (base < nextSeqNum && state.running) {
             log(`[Sender] Timeout! No Cumulative ACK for Frame ${base + 1}.`, 'warning');
             log(`[Sender] Retransmitting Window starting from Frame ${base + 1}...`, 'warning');
             
             // Go Back N
             nextSeqNum = base; 
        }
    }

    async function handleFlightGBN(seq) {
        if (!state.running) return;

        const packet = createPacket(seq, false);
        const isLoss = state.lostFrames.has(seq);
        
        if (isLoss) {
            await movePacketWithLoss(packet, seq, true);
            log(`[Channel] Frame ${seq + 1} LOST!`, 'error');
            state.lostFrames.delete(seq);
            return;
        }
        
        await movePacketWithLoss(packet, seq, false);
        packet.remove();
        
        // Receiver Logic
        if (seq === base) {
            log(`[Receiver] Accepted Frame ${seq + 1}`);
            addToQueue(elements.receiverQueue, `Frame ${seq + 1}`);
            
            // Send Cumulative ACK
            log(`[Receiver] Sending Cumulative ACK ${seq + 1}`);
            const ack = createPacket(seq, true);
            ack.innerText = `ACK ${seq + 1}`; // Cumulative label
            await animatePacket(ack, true);
            ack.remove();
            
            log(`[Sender] Got Cumulative ACK ${seq + 1}`);
            if (seq === base) { // Double check correctness
                base++;
                elements.windowText.innerText = `[${base+1} ... ${Math.min(base+state.windowSize, state.totalFrames)}]`;
            }
        } else {
            log(`[Receiver] Discarding Frame ${seq + 1} (Expected ${base + 1})`, 'error');
            // No ACK sent
        }
    }
}

// 4. SELECTIVE REPEAT (BUFFERING + INDIVIDUAL ACKS)
async function runSelectiveRepeat() {
    let base = 0; // Sender's Base
    let receiverBase = 0; // Receiver's Expected Sequence Number
    let nextSeqNum = 0;
    let acked = new Array(state.totalFrames).fill(false);
    
    // We use a separate buffer tracker for receiver to know what it has "buffered"
    // distinct from what sender knows is "acked"
    let receivedBuffer = new Array(state.totalFrames).fill(false);
    
    while (base < state.totalFrames && state.running) {
        
        // 1. Send New Frames
        let actionTaken = false;
        if (nextSeqNum < base + state.windowSize && nextSeqNum < state.totalFrames) {
             log(`[Sender] Sending Frame ${nextSeqNum + 1}`);
             addToQueue(elements.senderQueue, `Frame ${nextSeqNum + 1}`);
             
             handleFlightSR(nextSeqNum);
             
             nextSeqNum++;
             actionTaken = true;
             await sleep(500);
        }
        
        // 2. Check Slide (Sender Side)
        if (acked[base]) {
            while(base < state.totalFrames && acked[base]) {
                base++;
            }
            log(`[Sender] Window slides to Frame ${base + 1}`);
            elements.windowText.innerText = `[${base+1} ... ${Math.min(base+state.windowSize, state.totalFrames)}]`;
            actionTaken = true;
        }
        
        // 3. Timeout Logic
        // If we can't send (window full or done) AND we can't slide (base unacked), then Timeout Base.
        if (!actionTaken && base < state.totalFrames && !acked[base]) {
             // Wait a bit to ensure it's not just in-flight
             await sleep(SPEED + 500);
             
             // Check again
             if (!acked[base] && state.running) {
                 log(`[Sender] Timeout for Frame ${base + 1}!`, 'warning');
                 log(`[Sender] Retransmitting ONLY Frame ${base + 1}`, 'warning');
                 
                 // Retransmit specific frame
                 await handleFlightSR(base);
             }
        } else {
            await sleep(100);
        }
    }

    async function handleFlightSR(seq) {
        const packet = createPacket(seq, false);
        const isLoss = state.lostFrames.has(seq);
        
        if (isLoss) {
            await movePacketWithLoss(packet, seq, true);
            log(`[Channel] Frame ${seq + 1} LOST!`, 'error');
            state.lostFrames.delete(seq); 
            return;
        }
        
        await movePacketWithLoss(packet, seq, false);
        packet.remove();
        
        // Receiver Logic
        log(`[Receiver] Frame ${seq + 1} Received.`);
        const isDuplicate = receivedBuffer[seq]; // Check before marking
        receivedBuffer[seq] = true;
        
        if (seq === receiverBase) {
             // Exact expected frame
             log(`[Receiver] Delivering Frame ${seq + 1}`);
             addToQueue(elements.receiverQueue, `Frame ${seq + 1}`);
             receiverBase++;
             
             // Check for subsequent buffered frames
             while(receiverBase < state.totalFrames && receivedBuffer[receiverBase]) {
                 log(`[Receiver] Delivering Buffered Frame ${receiverBase + 1}`);
                 
                 // Remove the visual "Buffered" element if it exists
                 const buffEl = document.getElementById(`buffered-${receiverBase}`);
                 if (buffEl) buffEl.remove();
                 
                 addToQueue(elements.receiverQueue, `Frame ${receiverBase + 1}`);
                 receiverBase++;
             }
        } else if (seq > receiverBase) {
             // Out of order
             if (!isDuplicate) {
                 log(`[Receiver] Buffering Out-of-Order Frame ${seq + 1}`);
                 
                 // Manually add to queue with ID so we can remove it later
                 const bufDiv = document.createElement('div');
                 bufDiv.className = 'frame-item'; // Assumed class used by addToQueue
                 bufDiv.innerText = `Buffered ${seq + 1}`;
                 bufDiv.id = `buffered-${seq}`;
                 // Prepend to match addToQueue behavior (newest top)
                 elements.receiverQueue.prepend(bufDiv);
             } else {
                 log(`[Receiver] Duplicate Frame ${seq + 1} (Already Buffered). Ignoring.`);
             }
             
        } else {
             // Duplicate / Old
             log(`[Receiver] Duplicate Frame ${seq + 1}. Re-ACKing.`);
        }

        // Send Individual ACK
        log(`[Receiver] Sending Individual ACK ${seq + 1}`);
        const ack = createPacket(seq, true); // createPacket now handles 1-based text
        await animatePacket(ack, true);
        ack.remove();
        
        log(`[Sender] Got ACK ${seq + 1}`);
        acked[seq] = true; // Updates sender view
    }
}
