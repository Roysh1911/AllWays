// Background tasks must be defined at the top level, before the app renders,
// so iOS can run them when it wakes the app in the background.
import './src/lib/backgroundTasks';
import 'expo-router/entry';
