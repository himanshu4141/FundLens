import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '@/src/constants/theme';

// Dynamic import to prevent startup crashes on native if the native module is
// missing from the binary (it must be in the prebuild — OTA cannot add it).
let WebViewComponent: React.ComponentType<Record<string, unknown>> | null = null;
try {
    if (Platform.OS !== 'web') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { WebView } = require('react-native-webview');
        WebViewComponent = WebView;
    }
} catch {
    console.warn('[CamsWebViewModal] react-native-webview module not found or failed to load');
}

interface CamsWebViewModalProps {
    visible: boolean;
    onClose: () => void;
    email: string;
    pan: string;
}

const CAMS_URL = 'https://mycams.camsonline.com/InvestorService/InvestorExplor/CAS';

// Injected JS to help with auto-filling if possible or just visual cleanup
const INJECTED_JAVASCRIPT = `
  (function() {
    // Visual cleanup or auto-fill logic can go here
    true;
  })();
`;

export function CamsWebViewModal({ visible, onClose, email, pan }: CamsWebViewModalProps) {
    const [loading, setLoading] = useState(true);
    const [copiedEmail, setCopiedEmail] = useState(false);
    const [copiedPan, setCopiedPan] = useState(false);

    const copyToClipboard = async (text: string, type: 'email' | 'pan') => {
        await Clipboard.setStringAsync(text);
        if (type === 'email') {
            setCopiedEmail(true);
            setTimeout(() => setCopiedEmail(false), 2000);
        } else {
            setCopiedPan(true);
            setTimeout(() => setCopiedPan(false), 2000);
        }
    };

    const renderContent = () => {
        // If web or if native module failed to load, show instructions + browser fallback
        if (Platform.OS === 'web' || !WebViewComponent) {
            return (
                <View style={styles.webFallbackContainer}>
                    <View style={styles.webFallbackIcon}>
                        <Ionicons name="globe-outline" size={40} color={Colors.primary} />
                    </View>
                    <Text style={styles.webFallbackTitle}>Open CAMS in Browser</Text>
                    <Text style={styles.webFallbackText}>
                        {Platform.OS === 'web'
                            ? "CAMS Online does not allow embedding in 3rd party web apps. Please open it in a new window."
                            : "Native WebView module is missing. Please rebuild the dev client or open in browser."}
                    </Text>

                    <View style={styles.webFallbackSteps}>
                        <View style={styles.stepRow}>
                            <Text style={styles.stepNumber}>1</Text>
                            <Text style={styles.stepText}>Open CAMS and login with your PAN/Email</Text>
                        </View>
                        <View style={styles.stepRow}>
                            <Text style={styles.stepNumber}>2</Text>
                            <Text style={styles.stepText}>Go to &apos;CAS Summary&apos; or &apos;Statement&apos;</Text>
                        </View>
                        <View style={styles.stepRow}>
                            <Text style={styles.stepNumber}>3</Text>
                            <Text style={styles.stepText}>Request statement to your registered email</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.openBtn}
                        onPress={() => Linking.openURL(CAMS_URL)}
                    >
                        <Text style={styles.openBtnText}>Open CAMS Portal</Text>
                        <Ionicons name="open-outline" size={18} color="#fff" />
                    </TouchableOpacity>
                </View>
            );
        }

        // Native WebView implementation
        return (
            <View style={{ flex: 1 }}>
                {loading && (
                    <View style={styles.loaderCover}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={styles.loadingText}>Loading CAMS Online...</Text>
                    </View>
                )}
                <WebViewComponent
                    source={{ uri: CAMS_URL }}
                    injectedJavaScript={INJECTED_JAVASCRIPT}
                    onLoadEnd={() => setLoading(false)}
                    onLoadStart={() => setLoading(true)}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    scalesPageToFit={true}
                    style={{ flex: 1 }}
                />
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.title}>CAMS Online</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Helper info bar to copy credentials while browsing */}
                <View style={styles.helperBar}>
                    <View style={styles.helperItem}>
                        <Text style={styles.helperLabel}>Email</Text>
                        <TouchableOpacity
                            style={styles.copyBtn}
                            onPress={() => copyToClipboard(email, 'email')}
                        >
                            <Text style={styles.copyBtnText} numberOfLines={1}>{email}</Text>
                            <Ionicons
                                name={copiedEmail ? "checkmark-circle" : "copy-outline"}
                                size={14}
                                color={copiedEmail ? "#51D3A3" : Colors.primary}
                            />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.verticalDivider} />
                    <View style={styles.helperItem}>
                        <Text style={styles.helperLabel}>PAN</Text>
                        <TouchableOpacity
                            style={styles.copyBtn}
                            onPress={() => copyToClipboard(pan, 'pan')}
                        >
                            <Text style={styles.copyBtnText}>{pan}</Text>
                            <Ionicons
                                name={copiedPan ? "checkmark-circle" : "copy-outline"}
                                size={14}
                                color={copiedPan ? "#51D3A3" : Colors.primary}
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                {renderContent()}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: '#fff',
    },
    closeBtn: {
        padding: 8,
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    helperBar: {
        flexDirection: 'row',
        backgroundColor: '#f8f9fa',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        gap: 12,
    },
    helperItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    helperLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.textTertiary,
        textTransform: 'uppercase',
    },
    copyBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e9ecef',
        gap: 6,
    },
    copyBtnText: {
        flex: 1,
        fontSize: 12,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    verticalDivider: {
        width: 1,
        height: '100%',
        backgroundColor: '#eee',
    },
    loaderCover: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    loadingText: {
        marginTop: 10,
        color: Colors.textSecondary,
        fontSize: 14,
    },
    webFallbackContainer: {
        flex: 1,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
    },
    webFallbackIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(15, 107, 87, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    webFallbackTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: Colors.textPrimary,
        textAlign: 'center',
    },
    webFallbackText: {
        fontSize: 15,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    webFallbackSteps: {
        width: '100%',
        backgroundColor: 'rgba(0,0,0,0.02)',
        padding: 16,
        borderRadius: 12,
        gap: 12,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    stepNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.primary,
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
        lineHeight: 24,
    },
    stepText: {
        flex: 1,
        fontSize: 14,
        color: Colors.textPrimary,
    },
    openBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
        gap: 10,
        marginTop: 10,
    },
    openBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
