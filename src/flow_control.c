/**
 * Flow Control Mechanisms in Computer Networks
 * Author: Computer Networks Professor
 * 
 * Protocols Implemented:
 * 1. Stop-and-Wait
 * 2. Sliding Window
 * 3. Go-Back-N
 * 4. Selective Repeat
 * 
 * Logic-based simulation for educational purposes.
 */

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h> // For sleep() to simulate delay

void stop_and_wait();
void sliding_window();
void go_back_n();
void selective_repeat();
void clear_screen();

int main() {
    int choice;
    while(1) {
        printf("\n---------------------------------\n");
        printf("FLOW CONTROL SIMULATION MENU\n");
        printf("---------------------------------\n");
        printf("1. Stop-and-Wait Protocol\n");
        printf("2. Sliding Window Protocol\n");
        printf("3. Go-Back-N Protocol\n");
        printf("4. Selective Repeat Protocol\n");
        printf("5. Exit\n");
        printf("Enter your choice: ");
        scanf("%d", &choice);

        switch(choice) {
            case 1: stop_and_wait(); break;
            case 2: sliding_window(); break;
            case 3: go_back_n(); break;
            case 4: selective_repeat(); break;
            case 5: exit(0);
            default: printf("Invalid choice! Please try again.\n");
        }
    }
    return 0;
}

void stop_and_wait() {
    int frames, i, loss_frame;
    printf("\n--- STOP-AND-WAIT PROTOCOL ---\n");
    printf("Enter number of frames to send: ");
    scanf("%d", &frames);
    printf("Enter frame number to simulate loss (0 for none): ");
    scanf("%d", &loss_frame);

    for (i = 1; i <= frames; i++) {
        printf("\n[Sender] Sending Frame %d...\n", i);
        
        if (i == loss_frame) {
            printf("[channel] Frame %d LOST!\n", i);
            printf("[Sender] Timer Expired! Retransmitting Frame %d...\n", i);
            loss_frame = 0; // Reset loss so retransmission succeeds
            i--; // Decrement to retry same frame
            continue;
        }

        printf("[Receiver] Frame %d Received.\n", i);
        printf("[Receiver] Sending ACK for Frame %d.\n", i);
        printf("[Sender] ACK Received for Frame %d.\n", i);
    }
    printf("\n--- Transmission Complete ---\n");
}

void sliding_window() {
    int frames, w_size, i;
    printf("\n--- SLIDING WINDOW PROTOCOL ---\n");
    printf("Enter total number of frames: ");
    scanf("%d", &frames);
    printf("Enter window size: ");
    scanf("%d", &w_size);

    int sent = 0;
    while (sent < frames) {
        printf("\nWindow Position: [");
        for (i = 0; i < w_size && (sent + i) < frames; i++) {
            printf(" %d ", sent + i + 1);
        }
        printf("]\n");

        for (i = 0; i < w_size && (sent + i) < frames; i++) {
            printf("[Sender] Sending Frame %d\n", sent + i + 1);
        }
        
        printf("[Receiver] ACK received for Window starting at %d\n", sent + 1);
        sent += w_size;
    }
    printf("\n--- Transmission Complete ---\n");
}

void go_back_n() {
    int frames, w_size, loss_frame, i, sent = 1;
    printf("\n--- GO-BACK-N PROTOCOL ---\n");
    printf("Enter total number of frames: ");
    scanf("%d", &frames);
    printf("Enter window size: ");
    scanf("%d", &w_size);
    printf("Enter frame number to simulate loss: ");
    scanf("%d", &loss_frame);

    while (sent <= frames) {
        int end = sent + w_size - 1;
        if (end > frames) end = frames;

        printf("\nCurrent Window: [ ");
        for (i = sent; i <= end; i++) printf("%d ", i);
        printf("]\n");

        // Sending frames in window
        for (i = sent; i <= end; i++) {
            printf("[Sender] Sending Frame %d\n", i);
            if (i == loss_frame) {
                printf("[Channel] Frame %d LOST!\n", i);
                printf("[Sender] Timer Expired for Frame %d or ACK not received.\n", i);
                printf("[Sender] Go-Back-N triggered. Resending window from Frame %d...\n", sent);
                loss_frame = 0; // Avoid infinite loop of loss
                break; // Break sending loop to retransmit
            } else {
                printf("[Receiver] Frame %d Received. ACK sent.\n", i);
                if (i == end) { // If we reached end of window without loss
                     sent = end + 1;
                }
            }
        }
        
        // If loss occurred, sent var isn't updated, so it loops back
        if (loss_frame == 0 && i < end) {
             // We broke out early due to loss simulation reset
             continue;
        }
    }
    printf("\n--- Transmission Complete ---\n");
}

void selective_repeat() {
    int frames, w_size, loss_frame, i;
    printf("\n--- SELECTIVE REPEAT PROTOCOL ---\n");
    printf("Enter total number of frames: ");
    scanf("%d", &frames);
    printf("Enter window size: ");
    scanf("%d", &w_size);
    printf("Enter frame number to simulate loss: ");
    scanf("%d", &loss_frame);

    int *acked = (int *)calloc(frames + 1, sizeof(int)); // 1-based index
    int sent_base = 1;

    while (sent_base <= frames) {
        int end = sent_base + w_size - 1;
        if (end > frames) end = frames;

        printf("\nCurrent Window: [ ");
        for (i = sent_base; i <= end; i++) printf("%d ", i);
        printf("]\n");

        for (i = sent_base; i <= end; i++) {
            if (acked[i]) continue; // Already acked

            printf("[Sender] Sending Frame %d\n", i);
            if (i == loss_frame) {
                printf("[Channel] Frame %d LOST!\n", i);
                printf("[Receiver] Frame %d Missing! NAK sent.\n", i);
                loss_frame = 0; // Reset
            } else {
                printf("[Receiver] Frame %d Received. ACK sent.\n", i);
                acked[i] = 1;
            }
        }

        // Slide window
        while (sent_base <= frames && acked[sent_base]) {
            sent_base++;
        }
        
        // Retransmission logic is implicit in loop as unacked frames in window are resent
        if (sent_base <= frames) {
            printf("\n[Sender] Retransmitting missing frames in current window...\n");
        }
    }
    
    free(acked);
    printf("\n--- Transmission Complete ---\n");
}
