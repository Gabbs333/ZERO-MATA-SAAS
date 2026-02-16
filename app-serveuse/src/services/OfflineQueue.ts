import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';

const QUEUE_KEY = '@offline_queue';

export interface QueuedCommand {
  id: string;
  type: 'create_commande';
  data: {
    table_id: string;
    items: Array<{
      produit_id: string;
      nom_produit: string;
      quantite: number;
      prix_unitaire: number;
    }>;
  };
  timestamp: number;
  retryCount: number;
}

class OfflineQueue {
  private queue: QueuedCommand[] = [];
  private isProcessing = false;

  async initialize() {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
    }
  }

  async addCommand(command: Omit<QueuedCommand, 'id' | 'timestamp' | 'retryCount'>) {
    const queuedCommand: QueuedCommand = {
      ...command,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.queue.push(queuedCommand);
    await this.saveQueue();
    
    // Try to process immediately
    this.processQueue();

    return queuedCommand.id;
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const command = this.queue[0];

      try {
        // Check if we're online
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log('Not authenticated, stopping queue processing');
          break;
        }

        // Try to execute the command
        if (command.type === 'create_commande') {
          const { error } = await supabase.rpc('create_commande', {
            p_table_id: command.data.table_id,
            p_items: command.data.items,
          });

          if (error) {
            throw error;
          }

          // Success - remove from queue
          this.queue.shift();
          await this.saveQueue();
          console.log('Successfully processed queued command:', command.id);
        }
      } catch (error) {
        console.error('Failed to process queued command:', error);
        
        // Increment retry count
        command.retryCount++;

        // If too many retries, remove from queue
        if (command.retryCount >= 5) {
          console.error('Max retries reached for command:', command.id);
          this.queue.shift();
          await this.saveQueue();
        } else {
          // Move to end of queue for retry
          this.queue.shift();
          this.queue.push(command);
          await this.saveQueue();
        }

        // Stop processing on error
        break;
      }
    }

    this.isProcessing = false;
  }

  async saveQueue() {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  async clearQueue() {
    this.queue = [];
    await this.saveQueue();
  }

  getQueueLength() {
    return this.queue.length;
  }

  getQueue() {
    return [...this.queue];
  }
}

export const offlineQueue = new OfflineQueue();
