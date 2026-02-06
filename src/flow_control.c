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
#include <unistd.h>

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
            printf("[Channel] Frame %d LOST! (Simulating Timeout)\n", i);
            printf("[Sender] Timer Expired! Retransmitting Frame %d...\n", i);
            loss_frame = 0;
            i--;
            continue;
        }

        printf("[Receiver] Frame %d Received.\n", i);
        printf("[Receiver] Sending ACK for Frame %d.\n", i);
        printf("[Sender] ACK Received for Frame %d.\n", i);
    }
    printf("\n--- Transmission Complete ---\n");
}

/* 
 * SLIDING WINDOW (PURE FLOW CONTROL)
 */
void sliding_window() {
    int frames, w_size, i;
    printf("\n--- SLIDING WINDOW PROTOCOL (FLOW CONTROL ONLY) ---\n");
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
        
        for (i = 0; i < w_size && (sent + i) < frames; i++) {
             printf("[Receiver] ACK sent for Frame %d\n", sent + i + 1);
        }
        
        printf("[Sender] ACKs Received. Sliding Window...\n");
        sent += w_size;
    }
    printf("\n--- Transmission Complete ---\n");
}

/* 
 * GO-BACK-N (ERROR CONTROL)
 */
void go_back_n() {
    int frames, w_size, loss_frame, i;
    int sent_base = 1;
    int next_seq_num = 1;
    
    printf("\n--- GO-BACK-N PROTOCOL ---\n");
    printf("Enter total number of frames: ");
    scanf("%d", &frames);
    printf("Enter window size: ");
    scanf("%d", &w_size);
    printf("Enter frame number to simulate loss (0 for none): ");
    scanf("%d", &loss_frame);

    while (sent_base <= frames) {
        while (next_seq_num < sent_base + w_size && next_seq_num <= frames) {
            printf("[Sender] Sending Frame %d\n", next_seq_num);
            if (next_seq_num == loss_frame) {
                printf("[Channel] Frame %d LOST!\n", next_seq_num);
            } 
            next_seq_num++;
        }

        int ack_received = 0;
        
        for (i = sent_base; i < next_seq_num; i++) {
            if (i == loss_frame) {
                printf("[Receiver] Expected Frame %d, but content missing (LOST).\n", i);
                printf("[Receiver] Discarding subsequent frames (Out-of-Order). No ACK sent.\n");
                
                printf("[Sender] Timeout! ACK not received for Frame %d.\n", i);
                printf("[Sender] Go-Back-N: Retransmitting window starting from Frame %d...\n", i);
                
                next_seq_num = i; 
                loss_frame = 0;
                ack_received = 0;
                break; 
            } else {
                printf("[Receiver] Frame %d Received. Sending Cumulative ACK %d.\n", i, i);
                sent_base++;
                ack_received = 1;
            }
        }
    }
    printf("\n--- Transmission Complete ---\n");
}

/*
 * SELECTIVE REPEAT (ERROR CONTROL)
 */
void selective_repeat() {
    int frames, w_size, loss_frame, i;
    int sent_base = 1;      
    int next_seq_num = 1;

    printf("\n--- SELECTIVE REPEAT PROTOCOL ---\n");
    printf("Enter total number of frames: ");
    scanf("%d", &frames);
    printf("Enter window size: ");
    scanf("%d", &w_size);
    printf("Enter frame number to simulate loss: ");
    scanf("%d", &loss_frame);

    int *acked = (int *)calloc(frames + 1, sizeof(int)); 

    while (sent_base <= frames) {
        printf("\nCurrent Window: [ ");
        int window_end = sent_base + w_size - 1;
        if (window_end > frames) window_end = frames;
        
        for (i = sent_base; i <= window_end; i++) {
             if (acked[i]) printf("(%d) ", i);
             else printf("%d ", i);
        }
        printf("]\n");

        int action_taken = 0;

        if (next_seq_num < sent_base + w_size && next_seq_num <= frames) {
            printf("\n[Sender] Sending Frame %d\n", next_seq_num);
            
            if (next_seq_num == loss_frame) {
                printf("[Channel] Frame %d LOST!\n", next_seq_num);
            } else {
                printf("[Receiver] Frame %d Received.\n", next_seq_num);
                if (next_seq_num > sent_base) {
                    printf("[Receiver] Buffering Out-of-Order Frame %d.\n", next_seq_num);
                }
                printf("[Receiver] Sending Individual ACK for Frame %d.\n", next_seq_num);
                acked[next_seq_num] = 1;
            }
            next_seq_num++;
            action_taken = 1;
        }

        if (acked[sent_base]) {
            printf("\n[Sender] ACKs received. Window base moves.\n");
            while (sent_base <= frames && acked[sent_base]) {
                sent_base++;
            }
            action_taken = 1;
        }

        if (!action_taken && sent_base <= frames && !acked[sent_base]) {
            printf("\n[Sender] Timeout for Frame %d!\n", sent_base);
            printf("[Sender] Retransmitting ONLY Frame %d.\n", sent_base);
            
            printf("\n[Sender] Sending Frame %d\n", sent_base);
            printf("[Receiver] Frame %d Received.\n", sent_base);
            
            int j = sent_base + 1;
            int buffered = 0;
            while (j <= frames && acked[j]) {
                buffered = 1;
                j++;
            }
            if (buffered) {
               printf("[Receiver] Delivering buffered Frames ");
               for (int k = sent_base + 1; k < j; k++) printf("%d, ", k);
               printf("in order.\n");
            }

            printf("[Receiver] Sending Individual ACK for Frame %d.\n", sent_base);
            acked[sent_base] = 1;
            
            printf("\n[Sender] Window slides forward.\n");
            while (sent_base <= frames && acked[sent_base]) {
                sent_base++;
            }
        }
    }
    
    free(acked);
    printf("\n--- Transmission Complete ---\n");
}