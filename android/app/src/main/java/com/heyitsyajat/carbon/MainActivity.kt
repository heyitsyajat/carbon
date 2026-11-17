package com.heyitsyajat.carbon

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import com.heyitsyajat.carbon.ui.CarbonRoot
import com.heyitsyajat.carbon.ui.CarbonViewModel

class MainActivity : ComponentActivity() {

    private val viewModel: CarbonViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { CarbonRoot(viewModel) }
    }
}
