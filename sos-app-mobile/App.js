import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import * as Location from 'expo-location';
import { sendSOS } from './sosService';

export default function App() {
  const [location, setLocation] = useState(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location permission required', 'Please enable location.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      setLocation(loc.coords);
    })();
  }, []);

  const handleSOS = async () => {
    try {
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
      setLocation(current.coords);

      const payload = {
        userId: 'demoUserId',
        lat: current.coords.latitude,
        lon: current.coords.longitude,
        accuracy: current.coords.accuracy,
        extra: { mode: 'manual', silent: false }
      };

      const res = await sendSOS(payload);
      if (res.ok) {
        Alert.alert('SOS sent', 'Your emergency contacts have been notified.');
      } else {
        Alert.alert('Error', 'Failed to send SOS.');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', err.message || 'Unable to send SOS');
    }
  };

  return (
    <View style={{flex:1,justifyContent:'center',alignItems:'center',padding:20}}>
      <Text style={{fontSize:18, marginBottom:20}}>Advanced SOS — demo</Text>
      <TouchableOpacity
        onPress={handleSOS}
        style={{
          width:180, height:180, borderRadius:90, backgroundColor:'#ff3b30',
          justifyContent:'center', alignItems:'center', shadowColor:'#000', elevation:6
        }}>
        <Text style={{color:'#fff', fontSize:28, fontWeight:'bold'}}>SOS</Text>
      </TouchableOpacity>

      {location && (
        <Text style={{marginTop:20}}>Location: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</Text>
      )}
    </View>
  );
    }
