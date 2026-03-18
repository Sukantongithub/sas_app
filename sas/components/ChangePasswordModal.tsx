import React, { useState } from 'react';
import {
    Modal,
    View,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Platform,
    KeyboardAvoidingView,
    ScrollView,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { authAPI } from '@/services/authApi';

interface ChangePasswordModalProps {
    visible: boolean;
    onClose: () => void;
}

type Field = 'current' | 'new' | 'confirm';

// ─── field key mapper ─────────────────────────────────────────────────────────
const fieldToKey = (field: Field): string => {
    if (field === 'current') return 'currentPassword';
    if (field === 'new') return 'newPassword';
    return 'confirmPassword';
};

// ─── password strength ────────────────────────────────────────────────────────
const getStrength = (pw: string): number => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
};

const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'];
// BUG FIX 3: index-0 is a valid neutral color so strength=0 never passes '' to RN
const STRENGTH_COLOR = ['#aaaaaa', '#F44336', '#FF9800', '#FFC107', '#4CAF50'];

// ─────────────────────────────────────────────────────────────────────────────
// BUG FIX 1: PasswordInput is defined OUTSIDE ChangePasswordModal so React
// never creates a new component type on every render — which was causing the
// keyboard/TextInput to unmount and remount on every keystroke.
// ─────────────────────────────────────────────────────────────────────────────
interface PasswordInputProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    field: Field;
    error?: string;
    placeholder: string;
    showPassword: boolean;
    onToggleShow: () => void;
    loading: boolean;
    onClearError: (key: string) => void;
    colorScheme: 'light' | 'dark' | null | undefined;
}

function PasswordInput({
    label,
    value,
    onChange,
    field,
    error,
    placeholder,
    showPassword,
    onToggleShow,
    loading,
    onClearError,
    colorScheme,
}: PasswordInputProps) {
    const isDark = colorScheme === 'dark';

    return (
        <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>{label}</ThemedText>
            <View
                style={[
                    styles.inputWrapper,
                    {
                        borderColor: error
                            ? '#F44336'
                            : isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                        backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
                    },
                ]}
            >
                <TextInput
                    style={[styles.input, { color: isDark ? '#fff' : '#1a1a1a' }]}
                    value={value}
                    onChangeText={v => {
                        onChange(v);
                        onClearError(fieldToKey(field));
                    }}
                    placeholder={placeholder}
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                />
                <TouchableOpacity
                    onPress={onToggleShow}
                    style={styles.eyeButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <IconSymbol
                        name={showPassword ? 'eye.slash.fill' : 'eye.fill'}
                        size={18}
                        color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'}
                    />
                </TouchableOpacity>
            </View>
            {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main modal component
// ─────────────────────────────────────────────────────────────────────────────
export default function ChangePasswordModal({ visible, onClose }: ChangePasswordModalProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const colors = Colors[colorScheme ?? 'light'];
    const { token } = useAuth();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState<Record<Field, boolean>>({
        current: false,
        new: false,
        confirm: false,
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const strength = getStrength(newPassword);

    // ── clear a single field error ────────────────────────────────────────────
    const clearError = (key: string) => {
        setErrors(prev => {
            if (!prev[key]) return prev;          // nothing to clear → no re-render
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    // ── eye toggle ────────────────────────────────────────────────────────────
    const toggleShow = (field: Field) =>
        setShowPassword(prev => ({ ...prev, [field]: !prev[field] }));

    // ── validation ────────────────────────────────────────────────────────────
    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!currentPassword)
            e.currentPassword = 'Current password is required';
        if (!newPassword)
            e.newPassword = 'New password is required';
        else if (newPassword.length < 8)
            e.newPassword = 'At least 8 characters required';
        else if (!/[A-Z]/.test(newPassword))
            e.newPassword = 'Must include an uppercase letter';
        else if (!/[0-9]/.test(newPassword))
            e.newPassword = 'Must include a number';
        if (!confirmPassword)
            e.confirmPassword = 'Please confirm your new password';
        else if (newPassword !== confirmPassword)
            e.confirmPassword = 'Passwords do not match';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    // ── reset form ────────────────────────────────────────────────────────────
    const resetForm = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setErrors({});
        setShowPassword({ current: false, new: false, confirm: false });
    };

    // ── close (cancel) ────────────────────────────────────────────────────────
    const handleClose = () => {
        resetForm();
        onClose();
    };

    // ── submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!validate()) return;
        if (!token) {
            Alert.alert('Error', 'Session expired. Please log in again.');
            return;
        }

        setLoading(true);
        try {
            await authAPI.changePassword(currentPassword, newPassword, confirmPassword, token);

            // BUG FIX 2: setLoading(false) BEFORE calling handleSuccessClose so
            // the modal's state is clean when onClose fires.
            setLoading(false);
            resetForm();

            if (Platform.OS === 'web') {
                window.alert('Password changed successfully!');
                onClose();
            } else {
                Alert.alert('Success', 'Your password has been changed successfully.', [
                    { text: 'OK', onPress: onClose },
                ]);
            }
        } catch (err: any) {
            setLoading(false);
            const msg = err?.message || 'Failed to change password. Please try again.';
            if (Platform.OS === 'web') {
                window.alert(msg);
            } else {
                Alert.alert('Error', msg);
            }
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

                <View
                    style={[
                        styles.sheet,
                        { backgroundColor: isDark ? '#1c1c1e' : '#ffffff' },
                    ]}
                >
                    {/* Drag handle */}
                    <View style={styles.handle} />

                    {/* Header */}
                    <View style={styles.header}>
                        <View style={[styles.headerIcon, { backgroundColor: colors.tint + '18' }]}>
                            <IconSymbol name="lock.rotation" size={24} color={colors.tint} />
                        </View>
                        <View style={styles.headerText}>
                            <ThemedText style={styles.title}>Change Password</ThemedText>
                            <ThemedText style={styles.subtitle}>
                                Keep your account secure with a strong password
                            </ThemedText>
                        </View>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <IconSymbol
                                name="xmark.circle.fill"
                                size={26}
                                color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.25)'}
                            />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={styles.body}
                    >
                        {/* Current password */}
                        <PasswordInput
                            label="Current Password"
                            value={currentPassword}
                            onChange={setCurrentPassword}
                            field="current"
                            error={errors.currentPassword}
                            placeholder="Enter your current password"
                            showPassword={showPassword.current}
                            onToggleShow={() => toggleShow('current')}
                            loading={loading}
                            onClearError={clearError}
                            colorScheme={colorScheme}
                        />

                        {/* Divider */}
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        {/* New password */}
                        <PasswordInput
                            label="New Password"
                            value={newPassword}
                            onChange={setNewPassword}
                            field="new"
                            error={errors.newPassword}
                            placeholder="Min 8 chars, uppercase & number"
                            showPassword={showPassword.new}
                            onToggleShow={() => toggleShow('new')}
                            loading={loading}
                            onClearError={clearError}
                            colorScheme={colorScheme}
                        />

                        {/* Strength meter */}
                        {newPassword.length > 0 && (
                            <View style={styles.strengthContainer}>
                                <View style={styles.strengthBars}>
                                    {[1, 2, 3, 4].map(n => (
                                        <View
                                            key={n}
                                            style={[
                                                styles.strengthBar,
                                                {
                                                    backgroundColor:
                                                        strength >= n
                                                            ? STRENGTH_COLOR[strength]
                                                            : isDark
                                                                ? 'rgba(255,255,255,0.1)'
                                                                : 'rgba(0,0,0,0.08)',
                                                },
                                            ]}
                                        />
                                    ))}
                                </View>
                                <ThemedText
                                    style={[styles.strengthLabel, { color: STRENGTH_COLOR[strength] }]}
                                >
                                    {STRENGTH_LABEL[strength]}
                                </ThemedText>
                            </View>
                        )}

                        {/* Password rules hint */}
                        <View
                            style={[
                                styles.rulesCard,
                                { backgroundColor: colors.tint + '10', borderColor: colors.tint + '25' },
                            ]}
                        >
                            {[
                                { regex: /^.{8,}$/, label: 'At least 8 characters' },
                                { regex: /[A-Z]/, label: 'One uppercase letter' },
                                { regex: /[0-9]/, label: 'One number' },
                            ].map(({ regex, label }) => {
                                const met = regex.test(newPassword);
                                return (
                                    <ThemedText
                                        key={label}
                                        style={[
                                            styles.ruleItem,
                                            {
                                                color: met
                                                    ? '#4CAF50'
                                                    : isDark
                                                        ? 'rgba(255,255,255,0.55)'
                                                        : 'rgba(0,0,0,0.5)',
                                            },
                                        ]}
                                    >
                                        {met ? '✓' : '○'} {label}
                                    </ThemedText>
                                );
                            })}
                        </View>

                        {/* Confirm password */}
                        <PasswordInput
                            label="Confirm New Password"
                            value={confirmPassword}
                            onChange={setConfirmPassword}
                            field="confirm"
                            error={errors.confirmPassword}
                            placeholder="Re-enter your new password"
                            showPassword={showPassword.confirm}
                            onToggleShow={() => toggleShow('confirm')}
                            loading={loading}
                            onClearError={clearError}
                            colorScheme={colorScheme}
                        />

                        {/* Submit button */}
                        <TouchableOpacity
                            style={[
                                styles.submitButton,
                                { backgroundColor: colors.tint, opacity: loading ? 0.75 : 1 },
                            ]}
                            onPress={handleSubmit}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <>
                                    <IconSymbol name="checkmark.shield.fill" size={18} color="#fff" />
                                    <ThemedText style={styles.submitText}>Update Password</ThemedText>
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleClose}
                            style={styles.cancelButton}
                            disabled={loading}
                        >
                            <ThemedText
                                style={[
                                    styles.cancelText,
                                    { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' },
                                ]}
                            >
                                Cancel
                            </ThemedText>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 12,
        paddingHorizontal: 20,
        paddingBottom: 34,
        maxHeight: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 20,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(128,128,128,0.3)',
        alignSelf: 'center',
        marginBottom: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        gap: 12,
    },
    headerIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 12,
        opacity: 0.55,
        lineHeight: 16,
    },
    closeButton: {
        padding: 4,
    },
    body: {
        paddingBottom: 8,
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        opacity: 0.65,
        marginBottom: 8,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 50,
    },
    input: {
        flex: 1,
        fontSize: 15,
        fontWeight: '400',
    },
    eyeButton: {
        paddingLeft: 10,
    },
    errorText: {
        fontSize: 12,
        color: '#F44336',
        marginTop: 5,
        marginLeft: 2,
    },
    divider: {
        height: 1,
        marginVertical: 8,
        opacity: 0.4,
    },
    strengthContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: -8,
        marginBottom: 12,
    },
    strengthBars: {
        flexDirection: 'row',
        gap: 4,
        flex: 1,
    },
    strengthBar: {
        flex: 1,
        height: 4,
        borderRadius: 2,
    },
    strengthLabel: {
        fontSize: 12,
        fontWeight: '600',
        width: 40,
        textAlign: 'right',
    },
    rulesCard: {
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginBottom: 16,
        gap: 4,
    },
    ruleItem: {
        fontSize: 12,
        lineHeight: 20,
        fontWeight: '500',
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        borderRadius: 14,
        marginTop: 8,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 4,
    },
    submitText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    cancelButton: {
        alignItems: 'center',
        paddingVertical: 14,
    },
    cancelText: {
        fontSize: 14,
        fontWeight: '500',
    },
});
