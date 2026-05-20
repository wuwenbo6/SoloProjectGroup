package com.textreader.data.database

import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import android.content.Context
import com.textreader.data.dao.SettingsDao
import com.textreader.data.dao.TextItemDao
import com.textreader.data.dao.VoiceProfileDao
import com.textreader.data.entity.Settings
import com.textreader.data.entity.TextItem
import com.textreader.data.entity.VoiceProfile

@Database(
    entities = [TextItem::class, Settings::class, VoiceProfile::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun textItemDao(): TextItemDao
    abstract fun settingsDao(): SettingsDao
    abstract fun voiceProfileDao(): VoiceProfileDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "text_reader_database"
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}
