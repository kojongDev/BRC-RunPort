/**
 * RunPort 메인 앱 컴포넌트
 */

import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import React, { useEffect } from "react";
import { StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { requestStartupPermissions } from "./src/services/PermissionService";

// Screens
import HistoryScreen from "./src/screens/HistoryScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ResultScreen from "./src/screens/ResultScreen";
import RunDetailScreen from "./src/screens/RunDetailScreen";
import RunningScreen from "./src/screens/RunningScreen";
import { RootStackParamList } from "./src/types/navigation";

const Stack = createStackNavigator<RootStackParamList>();

function App(): React.JSX.Element {
	useEffect(() => {
		// 앱 시작 시 권한 일괄 요청
		requestStartupPermissions();
	}, []);
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaProvider>
				<StatusBar barStyle="dark-content" />
				<NavigationContainer>
					<Stack.Navigator
						initialRouteName="Home"
						screenOptions={{
							headerShown: false,
						}}
					>
						<Stack.Screen name="Home" component={HomeScreen} />
						<Stack.Screen
							name="Running"
							component={RunningScreen}
							options={{
								gestureEnabled: false, // 러닝 중에는 스와이프로 뒤로 가기 방지
							}}
						/>
						<Stack.Screen name="Result" component={ResultScreen} />
						<Stack.Screen name="History" component={HistoryScreen} />
						<Stack.Screen name="RunDetail" component={RunDetailScreen} />
					</Stack.Navigator>
				</NavigationContainer>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}

export default App;
